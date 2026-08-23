import { container } from '@sapphire/framework';

/**
 * Redis Helper Functions
 * Wrapper functions for common Redis operations using the container
 */

// Cache key prefixes for organization
export const CacheKeys = {
  GUILD: (guildId: string) => `guild:${guildId}`,
  USER: (userId: string) => `user:${userId}`,
  COMMAND_COOLDOWN: (userId: string, commandName: string) => `cooldown:${userId}:${commandName}`,
  RATE_LIMIT: (userId: string) => `ratelimit:${userId}`,
  SESSION: (sessionId: string) => `session:${sessionId}`,
} as const;

/** Redis pub/sub channels for real-time moderation events */
export const ModEventChannels = {
  MOD_EVENTS: (guildId: string) => `mod:events:${guildId}`,
} as const;

/**
 * Set a value in Redis with optional expiration
 */
export async function setCache(
  key: string,
  value: string | number | object,
  expirationSeconds?: number
): Promise<void> {
  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);

  if (expirationSeconds) {
    await container.redis.setex(key, expirationSeconds, serialized);
  } else {
    await container.redis.set(key, serialized);
  }
}

/**
 * Get a value from Redis
 */
export async function getCache<T = string>(key: string, parseJson = false): Promise<T | null> {
  const value = await container.redis.get(key);

  if (!value) return null;

  if (parseJson) {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  return value as T;
}

/**
 * Delete a key from Redis
 */
export async function deleteCache(key: string): Promise<void> {
  await container.redis.del(key);
}

/**
 * Check if a key exists in Redis
 */
export async function hasCache(key: string): Promise<boolean> {
  const exists = await container.redis.exists(key);
  return exists === 1;
}

/**
 * Set command cooldown for a user
 */
export async function setCooldown(
  userId: string,
  commandName: string,
  seconds: number
): Promise<void> {
  const key = CacheKeys.COMMAND_COOLDOWN(userId, commandName);
  await container.redis.setex(key, seconds, Date.now().toString());
}

/**
 * Check if user is on cooldown for a command
 */
export async function checkCooldown(userId: string, commandName: string): Promise<number> {
  const key = CacheKeys.COMMAND_COOLDOWN(userId, commandName);
  const ttl = await container.redis.ttl(key);
  return ttl > 0 ? ttl : 0;
}

/**
 * Increment a counter (useful for rate limiting)
 */
export async function incrementCounter(key: string, expirationSeconds?: number): Promise<number> {
  const count = await container.redis.incr(key);

  if (expirationSeconds && count === 1) {
    await container.redis.expire(key, expirationSeconds);
  }

  return count;
}

/**
 * Get all keys matching a pattern
 */
export async function getKeys(pattern: string): Promise<string[]> {
  return await container.redis.keys(pattern);
}

/**
 * Delete all keys matching a pattern
 */
export async function deletePattern(pattern: string): Promise<number> {
  const keys = await getKeys(pattern);
  if (keys.length === 0) return 0;
  return await container.redis.del(...keys);
}

/**
 * Add item to a Redis set
 */
export async function addToSet(key: string, ...members: string[]): Promise<void> {
  await container.redis.sadd(key, ...members);
}

/**
 * Remove item from a Redis set
 */
export async function removeFromSet(key: string, ...members: string[]): Promise<void> {
  await container.redis.srem(key, ...members);
}

/**
 * Check if item exists in a Redis set
 */
export async function inSet(key: string, member: string): Promise<boolean> {
  const exists = await container.redis.sismember(key, member);
  return exists === 1;
}

/**
 * Get all members of a Redis set
 */
export async function getSetMembers(key: string): Promise<string[]> {
  return await container.redis.smembers(key);
}

/**
 * Add item to a sorted set with score
 */
export async function addToSortedSet(key: string, score: number, member: string): Promise<void> {
  await container.redis.zadd(key, score, member);
}

/**
 * Get top N items from sorted set
 */
export async function getTopFromSortedSet(
  key: string,
  count: number
): Promise<Array<{ member: string; score: number }>> {
  const results = await container.redis.zrevrange(key, 0, count - 1, 'WITHSCORES');
  const formatted: Array<{ member: string; score: number }> = [];

  for (let i = 0; i < results.length; i += 2) {
    const member = results[i];
    const scoreStr = results[i + 1];

    if (member !== undefined && scoreStr !== undefined) {
      formatted.push({
        member,
        score: parseFloat(scoreStr),
      });
    }
  }

  return formatted;
}

/**
 * Publish a message to a Redis channel
 */
export async function publish(channel: string, message: string | object): Promise<void> {
  const serialized = typeof message === 'object' ? JSON.stringify(message) : message;
  await container.redis.publish(channel, serialized);
}

/**
 * Subscribe to a Redis channel
 */
export function subscribe(channel: string, callback: (_message: string) => void): void {
  const subscriber = container.redis.duplicate();

  subscriber.subscribe(channel, (_err) => {
    if (_err) {
      console.error(`Failed to subscribe to ${channel}:`, _err);
    }
  });

  subscriber.on('message', (ch, message) => {
    if (ch === channel) {
      callback(message);
    }
  });
}

/**
 * Get Redis info
 */
export async function getRedisInfo(): Promise<string> {
  return await container.redis.info();
}

/**
 * Ping Redis
 */
export async function pingRedis(): Promise<string> {
  return await container.redis.ping();
}

/**
 * Distributed lock class for preventing race conditions
 */
export class RedisLock {
  constructor(private key: string) {}

  /**
   * Release the lock
   */
  async release(): Promise<boolean> {
    const result = await container.redis.del(this.key);
    return result > 0;
  }

  /**
   * Extend the lock TTL
   */
  async extend(additionalMs: number): Promise<boolean> {
    const ttl = await container.redis.pttl(this.key);
    if (ttl <= 0) return false;

    const newTtl = Math.ceil((ttl + additionalMs) / 1000);
    const result = await container.redis.expire(this.key, newTtl);
    return result === 1;
  }
}

/**
 * Acquire a distributed lock using Redis
 * @param key - Lock key
 * @param ttlMs - Time to live in milliseconds
 * @param retries - Number of retry attempts (default: 0)
 * @param retryDelayMs - Delay between retries in milliseconds (default: 100)
 * @returns RedisLock instance if acquired, null if failed
 */
export async function acquireLock(
  key: string,
  ttlMs: number,
  retries = 0,
  retryDelayMs = 100
): Promise<RedisLock | null> {
  const lockValue = Date.now().toString();
  const ttlSeconds = Math.ceil(ttlMs / 1000);

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Try to set the key with NX (only if not exists) and EX (expiration)
    const result = await container.redis.set(key, lockValue, 'EX', ttlSeconds, 'NX');

    if (result === 'OK') {
      return new RedisLock(key);
    }

    // If not the last attempt, wait before retrying
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  return null;
}

/**
 * Execute a function with a distributed lock
 * @param key - Lock key
 * @param ttlMs - Time to live in milliseconds
 * @param fn - Function to execute while holding the lock
 * @returns Result of the function or null if lock couldn't be acquired
 */
export async function withLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T | null> {
  const lock = await acquireLock(key, ttlMs);

  if (!lock) {
    return null;
  }

  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
