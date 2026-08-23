import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

// Mock the container before importing
vi.mock('@sapphire/framework', () => ({
  container: {
    logger: {
      warn: vi.fn(),
      debug: vi.fn(),
    },
    redis: {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      exists: vi.fn(),
      pipeline: vi.fn(() => ({
        set: vi.fn().mockReturnThis(),
        setex: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      })),
    },
  },
}));

// Set encryption key before importing
process.env.SESSION_ENCRYPTION_KEY = 'test-encryption-key-32-characters-long!';
process.env.NODE_ENV = 'test';

import {
  encryptSessionData,
  decryptSessionData,
  CacheKey,
  SessionDataSchema,
  setJson,
  getJson,
  deleteJson,
  hasJson,
} from '#lib/cache/typedCache.js';
import { container } from '@sapphire/framework';
import { z } from 'zod';

describe('Token Encryption', () => {
  describe('encryptSessionData / decryptSessionData', () => {
    it('should encrypt and decrypt tokens correctly (round-trip)', () => {
      const originalData = {
        accessToken: 'my-secret-access-token',
        refreshToken: 'my-secret-refresh-token',
        userId: '123456789',
        createdAt: '2024-01-15T10:00:00.000Z',
        expiresAt: '2024-01-15T11:00:00.000Z',
      };

      const encrypted = encryptSessionData(originalData);
      const decrypted = decryptSessionData(encrypted);

      expect(decrypted.accessToken).toBe(originalData.accessToken);
      expect(decrypted.refreshToken).toBe(originalData.refreshToken);
      expect(decrypted.userId).toBe(originalData.userId);
    });

    it('should produce different ciphertexts for same input (random salt)', () => {
      const data = {
        accessToken: 'my-secret-token',
        userId: '123',
        createdAt: '2024-01-01T00:00:00.000Z',
        expiresAt: '2024-01-01T01:00:00.000Z',
      };

      const encrypted1 = encryptSessionData(data);
      const encrypted2 = encryptSessionData(data);

      // Encrypted tokens should be different due to random salt and IV
      expect(encrypted1.accessToken).not.toBe(encrypted2.accessToken);
    });

    it('should handle session data without refresh token', () => {
      const data = {
        accessToken: 'access-only-token',
        userId: '123',
        createdAt: '2024-01-01T00:00:00.000Z',
        expiresAt: '2024-01-01T01:00:00.000Z',
        refreshToken: undefined,
      };

      const encrypted = encryptSessionData(data);
      const decrypted = decryptSessionData(encrypted);

      expect(decrypted.accessToken).toBe(data.accessToken);
      expect(decrypted.refreshToken).toBeUndefined();
    });

    it('should encrypt tokens in correct format (salt:iv:authTag:encrypted)', () => {
      const data = {
        accessToken: 'test-token',
        userId: '123',
        createdAt: '2024-01-01T00:00:00.000Z',
        expiresAt: '2024-01-01T01:00:00.000Z',
      };

      const encrypted = encryptSessionData(data);
      const parts = encrypted.accessToken.split(':');

      // Current format should have 4 parts: salt, iv, authTag, encrypted
      expect(parts).toHaveLength(4);
      // Salt should be 32 hex chars (16 bytes)
      expect(parts[0]).toMatch(/^[a-f0-9]{32}$/);
      // IV should be 32 hex chars (16 bytes)
      expect(parts[1]).toMatch(/^[a-f0-9]{32}$/);
      // AuthTag should be 32 hex chars (16 bytes)
      expect(parts[2]).toMatch(/^[a-f0-9]{32}$/);
      // Encrypted data should be hex
      expect(parts[3]).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('decryptToken edge cases', () => {
    it('should reject malformed encrypted tokens (wrong part count)', () => {
      const malformedData = {
        accessToken: 'only-two:parts',
        userId: '123',
        createdAt: '2024-01-01T00:00:00.000Z',
        expiresAt: '2024-01-01T01:00:00.000Z',
      };

      expect(() => decryptSessionData(malformedData)).toThrow('Invalid encrypted token format');
    });

    it('should reject malformed encrypted tokens (too many parts)', () => {
      const malformedData = {
        accessToken: 'one:two:three:four:five',
        userId: '123',
        createdAt: '2024-01-01T00:00:00.000Z',
        expiresAt: '2024-01-01T01:00:00.000Z',
      };

      expect(() => decryptSessionData(malformedData)).toThrow('Invalid encrypted token format');
    });

    it('should reject tokens with invalid hex in salt', () => {
      const badHexData = {
        accessToken: 'not-valid-hex-value!!!!!!!!!!!!!:00000000000000000000000000000000:00000000000000000000000000000000:abcdef',
        userId: '123',
        createdAt: '2024-01-01T00:00:00.000Z',
        expiresAt: '2024-01-01T01:00:00.000Z',
      };

      expect(() => decryptSessionData(badHexData)).toThrow();
    });

    it('should handle empty refresh token gracefully', () => {
      const data = {
        accessToken: 'test-token',
        refreshToken: '',
        userId: '123',
        createdAt: '2024-01-01T00:00:00.000Z',
        expiresAt: '2024-01-01T01:00:00.000Z',
      };

      // Empty string is falsy, so it should be skipped
      const encrypted = encryptSessionData(data);
      expect(encrypted.refreshToken).toBeUndefined();
    });
  });
});

describe('CacheKey', () => {
  it('should generate correct mod config key', () => {
    expect(CacheKey.modConfig('123')).toBe('mod:config:123');
  });

  it('should generate correct mod case key', () => {
    expect(CacheKey.modCase('123', 42)).toBe('mod:case:123:42');
  });

  it('should generate correct session key', () => {
    expect(CacheKey.session('abc-123')).toBe('session:abc-123');
  });

  it('should generate correct evidence keys', () => {
    expect(CacheKey.evidence('ev-123')).toBe('evidence:ev-123');
    expect(CacheKey.caseEvidence('guild-1', 5)).toBe('evidence:case:guild-1:5');
    expect(CacheKey.guildEvidence('guild-1')).toBe('evidence:guild:guild-1');
  });

  it('should generate correct voice-related keys', () => {
    expect(CacheKey.voiceMemberPresence('g1', 'u1')).toBe('guild:g1:voice:member:u1');
    expect(CacheKey.voiceChannelMembers('g1', 'c1')).toBe('guild:g1:voice:channel:c1:members');
    expect(CacheKey.voiceMuteAllState('g1', 'c1')).toBe('voiceMuteAll:state:g1:c1');
  });
});

describe('SessionDataSchema', () => {
  it('should validate correct session data', () => {
    const valid = {
      accessToken: 'token123',
      userId: '123456',
      createdAt: '2024-01-01T00:00:00.000Z',
      expiresAt: '2024-01-01T01:00:00.000Z',
    };

    const result = SessionDataSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate session data with optional refresh token', () => {
    const withRefresh = {
      accessToken: 'token123',
      refreshToken: 'refresh456',
      userId: '123456',
      createdAt: '2024-01-01T00:00:00.000Z',
      expiresAt: '2024-01-01T01:00:00.000Z',
    };

    const result = SessionDataSchema.safeParse(withRefresh);
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    const invalid = {
      accessToken: 'token123',
      // Missing userId, createdAt, expiresAt
    };

    const result = SessionDataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('Redis Cache Functions', () => {
  const testSchema = z.object({
    name: z.string(),
    value: z.number(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setJson', () => {
    it('should store validated JSON data', async () => {
      await setJson('test-key', testSchema, { name: 'test', value: 42 });

      expect(container.redis.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({ name: 'test', value: 42 })
      );
    });

    it('should use setex when TTL is provided', async () => {
      await setJson('test-key', testSchema, { name: 'test', value: 42 }, 3600);

      expect(container.redis.setex).toHaveBeenCalledWith(
        'test-key',
        3600,
        JSON.stringify({ name: 'test', value: 42 })
      );
    });

    it('should reject invalid data before storing', async () => {
      await expect(
        setJson('test-key', testSchema, { name: 'test', value: 'not-a-number' } as any)
      ).rejects.toThrow();

      expect(container.redis.set).not.toHaveBeenCalled();
    });
  });

  describe('getJson', () => {
    it('should return parsed and validated data', async () => {
      vi.mocked(container.redis.get).mockResolvedValue(JSON.stringify({ name: 'test', value: 42 }));

      const result = await getJson('test-key', testSchema);

      expect(result).toEqual({ name: 'test', value: 42 });
    });

    it('should return null when key does not exist', async () => {
      vi.mocked(container.redis.get).mockResolvedValue(null);

      const result = await getJson('nonexistent', testSchema);

      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      vi.mocked(container.redis.get).mockResolvedValue('not valid json');

      const result = await getJson('test-key', testSchema);

      expect(result).toBeNull();
      expect(container.logger.warn).toHaveBeenCalled();
    });

    it('should return null when data fails validation', async () => {
      vi.mocked(container.redis.get).mockResolvedValue(
        JSON.stringify({ name: 123, value: 'wrong' })
      );

      const result = await getJson('test-key', testSchema);

      expect(result).toBeNull();
      expect(container.logger.warn).toHaveBeenCalled();
    });
  });

  describe('deleteJson', () => {
    it('should delete a key', async () => {
      await deleteJson('test-key');

      expect(container.redis.del).toHaveBeenCalledWith('test-key');
    });
  });

  describe('hasJson', () => {
    it('should return true when key exists', async () => {
      vi.mocked(container.redis.exists).mockResolvedValue(1);

      const result = await hasJson('test-key');

      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      vi.mocked(container.redis.exists).mockResolvedValue(0);

      const result = await hasJson('nonexistent');

      expect(result).toBe(false);
    });
  });
});

// Cleanup
afterEach(() => {
  process.env = { ...originalEnv };
});
