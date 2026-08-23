/**
 * Rate Limit Gate - Per-action rate limiting for API routes
 *
 * Uses Redis for distributed rate limit tracking with sliding window counters.
 */

import { container } from '@sapphire/framework';

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

export class RateLimitGate {
  /** Configurable per-action rate limits */
  static readonly LIMITS: Record<string, RateLimitOptions> = {
    'evidence.upload': { maxRequests: 10, windowMs: 60_000 },
    'evidence.view': { maxRequests: 60, windowMs: 60_000 },
    'evidence.capture': { maxRequests: 5, windowMs: 60_000 },
    'dashboard.api': { maxRequests: 120, windowMs: 60_000 },
  } as const;

  /**
   * Check if an action is within rate limits.
   *
   * Uses a sliding window counter in Redis:
   * - Key: ratelimit:{userId}:{action}
   * - Each request adds a timestamped entry
   * - Entries outside the window are pruned
   */
  static async check(
    userId: string,
    action: string,
    options?: RateLimitOptions
  ): Promise<RateLimitResult> {
    const limits = options ?? RateLimitGate.LIMITS[action];
    if (!limits) {
      return { allowed: true, remaining: Infinity };
    }

    try {
      const redis = (container as unknown as { redis?: import('ioredis').default }).redis;
      if (!redis) {
        // If Redis is unavailable, fail open
        return { allowed: true, remaining: limits.maxRequests };
      }

      const key = `ratelimit:${userId}:${action}`;
      const now = Date.now();
      const windowStart = now - limits.windowMs;

      // Use a sorted set with score = timestamp
      const pipeline = redis.pipeline();
      // Remove entries outside the window
      pipeline.zremrangebyscore(key, 0, windowStart);
      // Count entries in the window
      pipeline.zcard(key);
      // Add current request
      pipeline.zadd(key, now, `${now}:${Math.random().toString(36).slice(2, 8)}`);
      // Set expiry on the key
      pipeline.pexpire(key, limits.windowMs);

      const results = await pipeline.exec();
      if (!results) {
        return { allowed: true, remaining: limits.maxRequests };
      }

      // zcard result is at index 1
      const currentCount = (results[1]?.[1] as number) ?? 0;
      const remaining = Math.max(0, limits.maxRequests - currentCount - 1);

      if (currentCount >= limits.maxRequests) {
        // Get the oldest entry to calculate retry-after
        const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
        const oldestTimestamp = oldest.length >= 2 ? parseInt(oldest[1]!, 10) : now;
        const retryAfterMs = Math.max(0, oldestTimestamp + limits.windowMs - now);

        return {
          allowed: false,
          remaining: 0,
          retryAfterMs,
        };
      }

      return { allowed: true, remaining };
    } catch {
      // Fail open if Redis errors
      return { allowed: true, remaining: limits?.maxRequests ?? Infinity };
    }
  }
}
