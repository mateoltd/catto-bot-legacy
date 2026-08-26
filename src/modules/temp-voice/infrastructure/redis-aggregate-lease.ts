import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { container } from "@sapphire/framework";
import type { TempVoiceLeaseRunner } from "../ports/temp-voice-lease.port.js";

const LEASE_TTL_MS = 30_000;
const LEASE_ACQUIRE_TIMEOUT_MS = 1_500;
const LEASE_RETRY_MIN_MS = 40;
const LEASE_RETRY_JITTER_MS = 80;

const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

const RENEW_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
end
return 0
`;

export class RedisAggregateLease {
  private renewal: ReturnType<typeof setInterval> | null = null;

  private constructor(
    private readonly key: string,
    private readonly token: string,
    private readonly ttlMs: number,
  ) {}

  public static async acquire(
    key: string,
    ttlMs = LEASE_TTL_MS,
  ): Promise<RedisAggregateLease | null> {
    const token = randomUUID();
    const acquired = await container.redis.set(key, token, "PX", ttlMs, "NX");
    if (acquired !== "OK") return null;

    const lease = new RedisAggregateLease(key, token, ttlMs);
    lease.startRenewal();
    return lease;
  }

  public async release(): Promise<void> {
    if (this.renewal) {
      clearInterval(this.renewal);
      this.renewal = null;
    }
    await container.redis.eval(RELEASE_SCRIPT, 1, this.key, this.token);
  }

  private startRenewal(): void {
    const intervalMs = Math.max(1_000, Math.floor(this.ttlMs / 3));
    this.renewal = setInterval(() => {
      container.redis
        .eval(RENEW_SCRIPT, 1, this.key, this.token, String(this.ttlMs))
        .then((renewed) => {
          if (Number(renewed) !== 1 && this.renewal) {
            clearInterval(this.renewal);
            this.renewal = null;
          }
        })
        .catch((error: unknown) => {
          container.logger.error(
            `[TempVoiceLease] Failed to renew ${this.key}:`,
            error,
          );
        });
    }, intervalMs);
    this.renewal.unref();
  }
}

async function acquireLeaseWithWait(
  key: string,
): Promise<RedisAggregateLease | null> {
  const deadline = Date.now() + LEASE_ACQUIRE_TIMEOUT_MS;
  for (;;) {
    const lease = await RedisAggregateLease.acquire(key);
    if (lease) return lease;

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return null;
    const retryDelayMs =
      LEASE_RETRY_MIN_MS + Math.floor(Math.random() * LEASE_RETRY_JITTER_MS);
    await delay(Math.min(remainingMs, retryDelayMs));
  }
}

export class TempVoiceLeaseBusyError extends Error {
  public constructor(public readonly aggregateKey: string) {
    super(`Temp voice aggregate is busy: ${aggregateKey}`);
    this.name = "TempVoiceLeaseBusyError";
  }
}

export async function withTempVoiceLease<T>(
  aggregateKey: string,
  callback: () => Promise<T>,
): Promise<T> {
  const leaseKey = `tempvoice:lease:${aggregateKey}`;
  const lease = await acquireLeaseWithWait(leaseKey);
  if (!lease) throw new TempVoiceLeaseBusyError(aggregateKey);

  try {
    return await callback();
  } finally {
    await lease.release().catch((error: unknown) => {
      container.logger.error(
        `[TempVoiceLease] Failed to release ${leaseKey}:`,
        error,
      );
    });
  }
}

export class RedisTempVoiceLeaseRunner implements TempVoiceLeaseRunner {
  public withLease<T>(
    aggregateKey: string,
    callback: () => Promise<T>,
  ): Promise<T> {
    return withTempVoiceLease(aggregateKey, callback);
  }
}
