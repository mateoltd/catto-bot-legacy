# Redis/Cache API

> Location: `src/lib/redis.ts`

Redis helper functions for caching, rate limiting, and distributed operations.

## Accessing Redis Directly

```typescript
import { container } from '@sapphire/framework';

// Direct Redis access
await container.redis.set('key', 'value');
const value = await container.redis.get('key');
```

## Cache Keys

Predefined key patterns for consistency:

```typescript
import { CacheKeys } from '#lib/redis.js';

CacheKeys.GUILD(guildId)           // 'guild:123456789'
CacheKeys.USER(userId)              // 'user:123456789'
CacheKeys.COMMAND_COOLDOWN(userId, cmd) // 'cooldown:123:ping'
CacheKeys.RATE_LIMIT(userId)        // 'ratelimit:123456789'
CacheKeys.SESSION(sessionId)        // 'session:abc123'
```

## Basic Operations

### `setCache(key, value, expirationSeconds?)`

Set a value in Redis with optional expiration.

```typescript
import { setCache } from '#lib/redis.js';

// String value
await setCache('mykey', 'myvalue');

// With expiration (60 seconds)
await setCache('mykey', 'myvalue', 60);

// Object (auto-serialized to JSON)
await setCache('config', { enabled: true }, 300);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Cache key |
| `value` | `string \| number \| object` | Value to store |
| `expirationSeconds` | `number?` | Optional TTL in seconds |

---

### `getCache<T>(key, parseJson?)`

Get a value from Redis.

```typescript
import { getCache } from '#lib/redis.js';

// String value
const value = await getCache('mykey');

// Parse as JSON
const config = await getCache<{ enabled: boolean }>('config', true);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Cache key |
| `parseJson` | `boolean` | Parse result as JSON (default: `false`) |

**Returns:** `Promise<T | null>`

---

### `deleteCache(key)`

Delete a key from Redis.

```typescript
import { deleteCache } from '#lib/redis.js';

await deleteCache('mykey');
```

---

### `hasCache(key)`

Check if a key exists.

```typescript
import { hasCache } from '#lib/redis.js';

if (await hasCache('mykey')) {
  // Key exists
}
```

**Returns:** `Promise<boolean>`

---

## Cooldowns & Rate Limiting

### `setCooldown(userId, commandName, seconds)`

Set a command cooldown for a user.

```typescript
import { setCooldown } from '#lib/redis.js';

// 10 second cooldown
await setCooldown(user.id, 'ping', 10);
```

---

### `checkCooldown(userId, commandName)`

Check remaining cooldown time.

```typescript
import { checkCooldown } from '#lib/redis.js';

const remaining = await checkCooldown(user.id, 'ping');
if (remaining > 0) {
  return reply(`Wait ${remaining}s before using this command again.`);
}
```

**Returns:** `Promise<number>` - Remaining seconds (0 if not on cooldown)

---

### `incrementCounter(key, expirationSeconds?)`

Increment a counter (useful for rate limiting).

```typescript
import { incrementCounter } from '#lib/redis.js';

// Count requests per minute
const count = await incrementCounter(`requests:${userId}`, 60);
if (count > 100) {
  return reply('Rate limit exceeded');
}
```

**Returns:** `Promise<number>` - New counter value

---

## Pattern Operations

### `getKeys(pattern)`

Get all keys matching a pattern.

```typescript
import { getKeys } from '#lib/redis.js';

const guildKeys = await getKeys('guild:*');
```

**Returns:** `Promise<string[]>`

---

### `deletePattern(pattern)`

Delete all keys matching a pattern.

```typescript
import { deletePattern } from '#lib/redis.js';

// Clear all cooldowns for a user
const deleted = await deletePattern(`cooldown:${userId}:*`);
```

**Returns:** `Promise<number>` - Number of deleted keys

---

## Set Operations

### `addToSet(key, ...members)`

Add items to a Redis set.

```typescript
import { addToSet } from '#lib/redis.js';

await addToSet('muted_users', user1.id, user2.id);
```

---

### `removeFromSet(key, ...members)`

Remove items from a Redis set.

```typescript
import { removeFromSet } from '#lib/redis.js';

await removeFromSet('muted_users', user.id);
```

---

### `inSet(key, member)`

Check if an item exists in a set.

```typescript
import { inSet } from '#lib/redis.js';

if (await inSet('muted_users', user.id)) {
  return reply('You are muted');
}
```

**Returns:** `Promise<boolean>`

---

### `getSetMembers(key)`

Get all members of a set.

```typescript
import { getSetMembers } from '#lib/redis.js';

const mutedUsers = await getSetMembers('muted_users');
```

**Returns:** `Promise<string[]>`

---

## Sorted Sets (Leaderboards)

### `addToSortedSet(key, score, member)`

Add item to a sorted set with score.

```typescript
import { addToSortedSet } from '#lib/redis.js';

// Add XP to leaderboard
await addToSortedSet(`leaderboard:${guildId}`, user.xp, user.id);
```

---

### `getTopFromSortedSet(key, count)`

Get top N items from sorted set.

```typescript
import { getTopFromSortedSet } from '#lib/redis.js';

const top10 = await getTopFromSortedSet(`leaderboard:${guildId}`, 10);
// [{ member: '123', score: 1500 }, { member: '456', score: 1200 }, ...]
```

**Returns:** `Promise<Array<{ member: string; score: number }>>`

---

## Pub/Sub

### `publish(channel, message)`

Publish a message to a channel.

```typescript
import { publish } from '#lib/redis.js';

await publish('events', { type: 'user_banned', userId: '123' });
```

---

### `subscribe(channel, callback)`

Subscribe to a channel.

```typescript
import { subscribe } from '#lib/redis.js';

subscribe('events', (message) => {
  const event = JSON.parse(message);
  console.log('Received:', event);
});
```

---

## Distributed Locking

### `acquireLock(key, ttlMs, retries?, retryDelayMs?)`

Acquire a distributed lock.

```typescript
import { acquireLock } from '#lib/redis.js';

const lock = await acquireLock('process:user:123', 5000, 3, 100);
if (!lock) {
  return; // Could not acquire lock
}

try {
  // Critical section
  await processUser();
} finally {
  await lock.release();
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Lock key |
| `ttlMs` | `number` | Lock TTL in milliseconds |
| `retries` | `number` | Retry attempts (default: `0`) |
| `retryDelayMs` | `number` | Delay between retries (default: `100`) |

**Returns:** `Promise<RedisLock | null>`

---

### `withLock<T>(key, ttlMs, fn)`

Execute a function with automatic lock management.

```typescript
import { withLock } from '#lib/redis.js';

const result = await withLock('process:user:123', 5000, async () => {
  return await processUser();
});

if (result === null) {
  // Lock could not be acquired
}
```

**Returns:** `Promise<T | null>`

---

### `RedisLock` Class

Lock instance returned by `acquireLock`.

```typescript
class RedisLock {
  async release(): Promise<boolean>;
  async extend(additionalMs: number): Promise<boolean>;
}
```

---

## Utility Functions

### `getRedisInfo()`

Get Redis server info.

```typescript
import { getRedisInfo } from '#lib/redis.js';

const info = await getRedisInfo();
```

---

### `pingRedis()`

Ping Redis server.

```typescript
import { pingRedis } from '#lib/redis.js';

const pong = await pingRedis(); // 'PONG'
```

---

## Related

- [Database API](database.md) - For persistent data
- [Typed Cache](../core/logging.md) - Higher-level cache with Zod validation
