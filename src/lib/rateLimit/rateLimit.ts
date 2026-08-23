import { container } from '@sapphire/framework';

function assertRedisAvailable(): void {
  const redis = (container as unknown as { redis?: unknown }).redis;
  if (!redis) {
    throw new Error('Redis is not configured (container.redis is missing).');
  }
}

/**
 * Options for rate limiting
 */
export interface RateLimitOptions {
  /** Minimum interval between actions in milliseconds */
  minIntervalMs: number;
}

/**
 * Token bucket options for more complex rate limiting
 */
export interface TokenBucketOptions {
  /** Maximum tokens in the bucket */
  maxTokens: number;
  /** Tokens refilled per second */
  refillRatePerSecond: number;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

/**
 * In-memory rate limiter for simple per-process throttling
 */
export class InMemoryRateLimiter {
  private readonly lastAction = new Map<string, number>();

  /**
   * Check if action is allowed and consume if so
   * @returns true if action is allowed, false if rate limited
   */
  tryTake(key: string, options: RateLimitOptions): boolean {
    const now = Date.now();
    const last = this.lastAction.get(key) ?? 0;

    if (now - last < options.minIntervalMs) {
      return false;
    }

    this.lastAction.set(key, now);
    return true;
  }

  /**
   * Get the time remaining until action is allowed
   * @returns milliseconds until allowed, or 0 if allowed now
   */
  getRetryAfter(key: string, options: RateLimitOptions): number {
    const now = Date.now();
    const last = this.lastAction.get(key) ?? 0;
    const elapsed = now - last;

    if (elapsed >= options.minIntervalMs) {
      return 0;
    }

    return options.minIntervalMs - elapsed;
  }

  /**
   * Throttle an action, returning result with retry info
   */
  throttle(key: string, options: RateLimitOptions): RateLimitResult {
    const retryAfterMs = this.getRetryAfter(key, options);

    if (retryAfterMs > 0) {
      return { allowed: false, retryAfterMs };
    }

    this.lastAction.set(key, Date.now());
    return { allowed: true };
  }

  /**
   * Clear rate limit for a key
   */
  reset(key: string): void {
    this.lastAction.delete(key);
  }

  /**
   * Clear all rate limits
   */
  clear(): void {
    this.lastAction.clear();
  }
}

/**
 * In-memory token bucket for more complex rate limiting
 */
export class TokenBucket {
  private readonly buckets = new Map<string, { tokens: number; lastRefill: number }>();

  constructor(private readonly options: TokenBucketOptions) {}

  /**
   * Try to consume a token
   * @returns true if token was consumed, false if bucket is empty
   */
  tryTake(key: string): boolean {
    const bucket = this.getBucket(key);
    this.refill(bucket);

    if (bucket.tokens < 1) {
      return false;
    }

    bucket.tokens -= 1;
    return true;
  }

  /**
   * Get current token count for a key
   */
  getTokens(key: string): number {
    const bucket = this.getBucket(key);
    this.refill(bucket);
    return bucket.tokens;
  }

  /**
   * Reset bucket for a key
   */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  private getBucket(key: string): { tokens: number; lastRefill: number } {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.options.maxTokens, lastRefill: Date.now() };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  private refill(bucket: { tokens: number; lastRefill: number }): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.options.refillRatePerSecond;

    bucket.tokens = Math.min(this.options.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }
}

/**
 * Redis-backed rate limiter for multi-instance correctness
 */
export class RedisRateLimiter {
  private readonly keyPrefix: string;

  constructor(keyPrefix = 'ratelimit') {
    this.keyPrefix = keyPrefix;
  }

  /**
   * Check if action is allowed and consume if so (atomic)
   */
  async tryTake(key: string, options: RateLimitOptions): Promise<boolean> {
    assertRedisAvailable();
    const fullKey = `${this.keyPrefix}:${key}`;

    // Use SET NX PX for atomic check-and-set
    const result = await container.redis.set(
      fullKey,
      Date.now().toString(),
      'PX',
      options.minIntervalMs,
      'NX'
    );

    return result === 'OK';
  }

  /**
   * Throttle an action with retry info
   */
  async throttle(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
    assertRedisAvailable();
    const fullKey = `${this.keyPrefix}:${key}`;

    // Try to set the key
    const result = await container.redis.set(
      fullKey,
      Date.now().toString(),
      'PX',
      options.minIntervalMs,
      'NX'
    );

    if (result === 'OK') {
      return { allowed: true };
    }

    // Get remaining TTL
    const ttl = await container.redis.pttl(fullKey);
    return {
      allowed: false,
      retryAfterMs: ttl > 0 ? ttl : options.minIntervalMs,
    };
  }

  /**
   * Clear rate limit for a key
   */
  async reset(key: string): Promise<void> {
    assertRedisAvailable();
    const fullKey = `${this.keyPrefix}:${key}`;
    await container.redis.del(fullKey);
  }
}

/**
 * Sliding window rate limiter using Redis sorted sets
 * More accurate for high-frequency rate limiting
 */
export class RedisSlidingWindowLimiter {
  private readonly keyPrefix: string;

  constructor(keyPrefix = 'sliding') {
    this.keyPrefix = keyPrefix;
  }

  /**
   * Check if action is allowed within a window
   * @param key - Unique key for the rate limit
   * @param maxRequests - Maximum requests allowed in the window
   * @param windowMs - Window size in milliseconds
   */
  async tryTake(key: string, maxRequests: number, windowMs: number): Promise<boolean> {
    assertRedisAvailable();
    const fullKey = `${this.keyPrefix}:${key}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const pipeline = container.redis.pipeline();

    // Remove old entries
    pipeline.zremrangebyscore(fullKey, 0, windowStart);

    // Count current entries
    pipeline.zcard(fullKey);

    // Add new entry
    pipeline.zadd(fullKey, now, `${now}-${Math.random()}`);

    // Set expiry
    pipeline.pexpire(fullKey, windowMs);

    const results = await pipeline.exec();
    const count = (results?.[1]?.[1] as number) ?? 0;

    if (count >= maxRequests) {
      // Remove the entry we just added
      await container.redis.zremrangebyscore(fullKey, now, now);
      return false;
    }

    return true;
  }
}

// Export singleton instances for convenience
export const memoryLimiter = new InMemoryRateLimiter();
export const redisLimiter = new RedisRateLimiter();
