import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { container } from "@sapphire/framework";
import {
  Queue,
  QueueEvents,
  Worker,
  type ConnectionOptions,
  type Job,
} from "bullmq";
import {
  TempVoiceDeliveryKind,
  TempVoiceLifecycle,
  TempVoiceOutboxStatus,
  type PrismaClient,
} from "@prisma/client";

import { CONFIG } from "#config.js";

import {
  REDIS_KEYS,
  TEMP_VOICE_OWNERSHIP_DELIVERY_EPOCH,
} from "../constants.js";
import type {
  TempVoiceCommand,
  TempVoiceSignal,
  TempVoiceTransportMessage,
} from "../domain/temp-voice.messages.js";
import type { TempVoiceResult } from "../domain/temp-voice.types.js";
import type {
  TempVoicePublishOptions,
  TempVoiceTransport,
} from "../ports/temp-voice-transport.port.js";
import type { TempVoiceRepository } from "../ports/temp-voice-repository.port.js";
import { TempVoiceCoordinator } from "../application/temp-voice-coordinator.js";
import { TempVoiceLeaseBusyError } from "./redis-aggregate-lease.js";

const QUEUE_NAME = "temp-voice-v2";
const SWEEP_INTERVAL_MS = 30_000;
const COMMAND_TIMEOUT_MS = 30_000;
const RECONCILE_BATCH_SIZE = 100;
const OUTBOX_RETENTION_MS = 86_400_000;
const SUPERSEDED_DELIVERY_RETENTION_MS = 30 * 86_400_000;
const PRESENCE_DIRTY_TTL_SECONDS = 3_600;
const SIGNAL_ATTEMPTS = 12;
const COMMAND_CONTENTION_TIMEOUT_MS = 10_000;
const COMMAND_CONTENTION_RETRY_MS = 150;

class TempVoiceRetryableResultError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TempVoiceRetryableResultError";
  }
}

export class BullTempVoiceTransport implements TempVoiceTransport {
  private readonly queue: Queue<TempVoiceTransportMessage>;
  private readonly queueEvents: QueueEvents;
  private readonly worker: Worker<TempVoiceTransportMessage>;
  private readonly sweepInterval: ReturnType<typeof setInterval>;
  private isSweeping = false;
  private currentSweep: Promise<void> | null = null;

  public constructor(
    private readonly prisma: PrismaClient,
    private readonly repository: TempVoiceRepository,
    private readonly coordinator: TempVoiceCoordinator,
  ) {
    const connection = this.connection();
    this.queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 8,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: { age: 3_600, count: 5_000 },
        removeOnFail: { age: 86_400, count: 5_000 },
      },
    });
    this.queueEvents = new QueueEvents(QUEUE_NAME, { connection });
    this.worker = new Worker(
      QUEUE_NAME,
      (job: Job<TempVoiceTransportMessage>) => this.processJob(job),
      {
        connection,
        concurrency: 25,
        limiter: { max: 100, duration: 1_000 },
      },
    );

    this.worker.on("failed", (job, error) => {
      if (
        error instanceof TempVoiceLeaseBusyError ||
        error.name === "TempVoiceLeaseBusyError"
      ) {
        container.logger.debug(
          `[TempVoiceTransport] Job ${job?.id ?? "unknown"} deferred because its aggregate is busy`,
        );
      } else if (
        error instanceof TempVoiceRetryableResultError ||
        error.name === "TempVoiceRetryableResultError"
      ) {
        container.logger.debug(
          `[TempVoiceTransport] Job ${job?.id ?? "unknown"} deferred: ${error.message}`,
        );
      } else {
        container.logger.error(
          `[TempVoiceTransport] Job ${job?.id ?? "unknown"} failed:`,
          error,
        );
      }
      if (
        job?.data.type === "OUTBOX" &&
        job.attemptsMade >= (job.opts.attempts ?? 1)
      ) {
        void this.recoverExhaustedOutbox(job.data.outboxId, error);
      }
    });
    this.worker.on("error", (error) => {
      container.logger.error("[TempVoiceTransport] Worker error:", error);
    });

    this.sweepInterval = setInterval(() => {
      this.startSweep();
    }, SWEEP_INTERVAL_MS);
    this.sweepInterval.unref();

    this.startSweep();
  }

  private async processJob(
    job: Job<TempVoiceTransportMessage>,
  ): Promise<TempVoiceResult<{ message: string }>> {
    const message = job.data;
    if (message.type === "COMMAND") {
      return this.dispatchInteractiveCommand(message);
    }
    if (
      message.type === "SIGNAL" &&
      message.signal.kind === "VOICE_STATE_OBSERVED"
    ) {
      await this.enqueuePresenceReconciliations(message.signal);
    }
    if (
      message.type === "SIGNAL" &&
      message.signal.kind === "CHANNEL_PRESENCE_DIRTY"
    ) {
      return this.processPresenceReconciliation(job, {
        type: "SIGNAL",
        signal: message.signal,
      });
    }
    return this.dispatchRetryable(message);
  }

  private async dispatchInteractiveCommand(
    message: Extract<TempVoiceTransportMessage, { type: "COMMAND" }>,
  ): Promise<TempVoiceResult<{ message: string }>> {
    const deadline = Date.now() + COMMAND_CONTENTION_TIMEOUT_MS;
    for (;;) {
      try {
        return await this.coordinator.dispatch(message);
      } catch (error) {
        const isLeaseBusy =
          error instanceof TempVoiceLeaseBusyError ||
          (error instanceof Error && error.name === "TempVoiceLeaseBusyError");
        if (!isLeaseBusy) throw error;
        if (Date.now() >= deadline) {
          return {
            ok: false,
            code: "CHANNEL_BUSY",
            message:
              "This channel is processing another update. Please try again in a moment.",
            retryable: true,
          };
        }
        await delay(COMMAND_CONTENTION_RETRY_MS);
      }
    }
  }

  private async enqueuePresenceReconciliations(
    signal: Extract<TempVoiceSignal, { kind: "VOICE_STATE_OBSERVED" }>,
  ): Promise<void> {
    const observedChannelIds = [
      ...new Set(
        [signal.oldChannelId, signal.newChannelId].filter(
          (channelId): channelId is string => channelId !== null,
        ),
      ),
    ];
    if (observedChannelIds.length === 0) return;

    const records = await this.prisma.tempVoiceChannel.findMany({
      where: {
        guildId: signal.guildId,
        channelId: { in: observedChannelIds },
        lifecycle: { not: TempVoiceLifecycle.DELETED },
      },
      select: { channelId: true },
    });
    const managedChannelIds = records
      .map((record) => record.channelId)
      .filter((channelId): channelId is string => channelId !== null);
    if (managedChannelIds.length === 0) return;

    const dirty = container.redis.multi();
    for (const channelId of managedChannelIds) {
      const key = this.presenceDirtyKey(signal.guildId, channelId);
      dirty.incr(key);
      dirty.expire(key, PRESENCE_DIRTY_TTL_SECONDS);
    }
    await dirty.exec();

    await Promise.all(
      managedChannelIds.map((channelId) =>
        this.enqueuePresenceJob({
          kind: "CHANNEL_PRESENCE_DIRTY",
          guildId: signal.guildId,
          channelId,
          observedAt: signal.observedAt,
        }),
      ),
    );
  }

  private async processPresenceReconciliation(
    job: Job<TempVoiceTransportMessage>,
    message: {
      readonly type: "SIGNAL";
      readonly signal: Extract<
        TempVoiceSignal,
        { kind: "CHANNEL_PRESENCE_DIRTY" }
      >;
    },
  ): Promise<TempVoiceResult<{ message: string }>> {
    const dirtyKey = this.presenceDirtyKey(
      message.signal.guildId,
      message.signal.channelId,
    );
    const observedGeneration = await container.redis.get(dirtyKey);
    const result = await this.dispatchRetryable(message);

    await job.removeDeduplicationKey();
    const latestGeneration = await container.redis.get(dirtyKey);
    if (latestGeneration !== observedGeneration) {
      await this.enqueuePresenceJob(message.signal);
    }
    return result;
  }

  private async enqueuePresenceJob(
    signal: Extract<TempVoiceSignal, { kind: "CHANNEL_PRESENCE_DIRTY" }>,
  ): Promise<void> {
    await this.queue.add(
      "presence",
      { type: "SIGNAL", signal },
      {
        priority: 2,
        attempts: SIGNAL_ATTEMPTS,
        deduplication: { id: `presence:${signal.channelId}` },
      },
    );
  }

  private async dispatchRetryable(
    message: TempVoiceTransportMessage,
  ): Promise<TempVoiceResult<{ message: string }>> {
    const result = await this.coordinator.dispatch(message);
    if (!result.ok && result.retryable) {
      throw new TempVoiceRetryableResultError(result.code, result.message);
    }
    return result;
  }

  private presenceDirtyKey(guildId: string, channelId: string): string {
    return `${REDIS_KEYS.PRESENCE_DIRTY}:${guildId}:${channelId}`;
  }

  public async submit(
    command: TempVoiceCommand,
  ): Promise<TempVoiceResult<{ message: string }>> {
    const job = await this.queue.add(
      "command",
      { type: "COMMAND", command },
      {
        jobId: `command-${randomUUID()}`,
        priority: 1,
        // Interactive mutations are retried by the caller. Retrying a toggle after the response
        // timed out could apply the inverse state and is less safe than returning a retryable error.
        attempts: 1,
      },
    );
    try {
      return (await job.waitUntilFinished(
        this.queueEvents,
        COMMAND_TIMEOUT_MS,
      )) as TempVoiceResult<{ message: string }>;
    } catch (error) {
      container.logger.warn(
        `[TempVoiceTransport] Interactive command ${job.id ?? "unknown"} could not complete: ${error instanceof Error ? error.name : "UnknownError"}`,
      );
      return {
        ok: false,
        code: "TRANSPORT_FAILED",
        message:
          "The temporary voice update could not be completed. Please try again.",
        retryable: true,
      };
    }
  }

  public async publish(
    signal: TempVoiceSignal,
    options: TempVoicePublishOptions = {},
  ): Promise<void> {
    await this.queue.add(
      "signal",
      { type: "SIGNAL", signal },
      {
        jobId: options.jobId,
        delay: options.delayMs,
        priority: 2,
        attempts: SIGNAL_ATTEMPTS,
      },
    );
  }

  public schedule(
    signal: TempVoiceSignal,
    delayMs: number,
    jobId: string,
  ): Promise<void> {
    return this.publish(signal, { delayMs, jobId });
  }

  public dispatch(
    message: TempVoiceTransportMessage,
  ): Promise<TempVoiceResult<{ message: string }>> {
    return this.coordinator.dispatch(message);
  }

  public async shutdown(): Promise<void> {
    clearInterval(this.sweepInterval);
    await this.currentSweep;
    await this.worker.close();
    await this.queueEvents.close();
    await this.queue.close();
  }

  public async sweep(): Promise<void> {
    if (this.isSweeping) return;
    this.isSweeping = true;
    try {
      const now = new Date();
      await this.prisma.tempVoiceOutbox.updateMany({
        where: {
          status: TempVoiceOutboxStatus.PROCESSING,
          updatedAt: { lt: new Date(now.getTime() - 60_000) },
        },
        data: {
          status: TempVoiceOutboxStatus.FAILED,
          availableAt: now,
          lastError: "Recovered abandoned PROCESSING effect.",
        },
      });
      await this.prisma.tempVoiceOutbox.deleteMany({
        where: {
          status: TempVoiceOutboxStatus.COMPLETED,
          completedAt: { lt: new Date(now.getTime() - OUTBOX_RETENTION_MS) },
        },
      });
      await this.prisma.tempVoiceDelivery.deleteMany({
        where: {
          status: "SUPERSEDED",
          updatedAt: {
            lt: new Date(now.getTime() - SUPERSEDED_DELIVERY_RETENTION_MS),
          },
          NOT: {
            epoch: TEMP_VOICE_OWNERSHIP_DELIVERY_EPOCH,
            kind: {
              in: [
                TempVoiceDeliveryKind.OWNERSHIP_NOTICE,
                TempVoiceDeliveryKind.OWNER_DM,
              ],
            },
          },
        },
      });

      const outbox = await this.prisma.tempVoiceOutbox.findMany({
        where: {
          status: {
            in: [TempVoiceOutboxStatus.PENDING, TempVoiceOutboxStatus.FAILED],
          },
          availableAt: { lte: now },
        },
        orderBy: { availableAt: "asc" },
        take: RECONCILE_BATCH_SIZE,
      });
      for (const effect of outbox) {
        await this.queue.add(
          "outbox",
          { type: "OUTBOX", outboxId: effect.id },
          {
            // Database status and the aggregate lease provide idempotency. A fresh job id avoids
            // an exhausted BullMQ job preventing a later database-driven recovery attempt.
            jobId: `outbox-${effect.id}-${randomUUID()}`,
            priority: 1,
          },
        );
        await this.prisma.tempVoiceOutbox.updateMany({
          where: {
            id: effect.id,
            status: {
              in: [TempVoiceOutboxStatus.PENDING, TempVoiceOutboxStatus.FAILED],
            },
          },
          data: { status: TempVoiceOutboxStatus.ENQUEUED },
        });
      }

      const due = await this.repository.listDue(now, RECONCILE_BATCH_SIZE);
      for (const record of due) {
        await this.publish(
          {
            kind: "RECONCILE_DUE",
            aggregateId: record.id,
            expectedRevision: record.revision,
            observedAt: now.getTime(),
          },
          { jobId: `due-${record.id}-${record.revision}-${now.getTime()}` },
        );
      }

      await this.finalizeDrainedConfigurations();
    } finally {
      this.isSweeping = false;
    }
  }

  private connection(): ConnectionOptions {
    return {
      host: CONFIG.REDIS_HOST,
      port: CONFIG.REDIS_PORT,
      password: CONFIG.REDIS_PASSWORD,
      db: CONFIG.REDIS_DB,
    };
  }

  private startSweep(): void {
    if (this.currentSweep) return;
    this.currentSweep = this.sweep()
      .catch((error: unknown) => {
        container.logger.error("[TempVoiceTransport] Sweep failed:", error);
      })
      .finally(() => {
        this.currentSweep = null;
      });
  }

  private async recoverExhaustedOutbox(
    outboxId: string,
    error: Error,
  ): Promise<void> {
    try {
      await this.prisma.tempVoiceOutbox.updateMany({
        where: {
          id: outboxId,
          status: TempVoiceOutboxStatus.ENQUEUED,
        },
        data: {
          status: TempVoiceOutboxStatus.FAILED,
          availableAt: new Date(),
          lastError: error.message.slice(0, 1_000),
        },
      });
    } catch (recoveryError) {
      container.logger.error(
        `[TempVoiceTransport] Could not recover exhausted outbox ${outboxId}:`,
        recoveryError,
      );
    }
  }

  private async finalizeDrainedConfigurations(): Promise<void> {
    const draining = await this.prisma.tempVoiceConfig.findMany({
      where: { drainingAt: { not: null } },
      select: { guildId: true },
      take: RECONCILE_BATCH_SIZE,
    });
    for (const config of draining) {
      const remaining = await this.prisma.tempVoiceChannel.count({
        where: {
          guildId: config.guildId,
          lifecycle: { not: "DELETED" },
        },
      });
      if (remaining === 0) {
        await this.prisma.tempVoiceConfig.deleteMany({
          where: { guildId: config.guildId, drainingAt: { not: null } },
        });
      }
    }
  }
}
