import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mocks
const { mockGetJson, mockDecryptSessionData } = vi.hoisted(() => ({
  mockGetJson: vi.fn(),
  mockDecryptSessionData: vi.fn(),
}));

vi.mock('#lib/cache/typedCache.js', () => ({
  getJson: mockGetJson,
  decryptSessionData: mockDecryptSessionData,
  SessionDataSchema: {
    // Stub schema - the real one is a zod object but we just pass it through
    parse: (v: unknown) => v,
    safeParse: (v: unknown) => ({ success: true, data: v }),
  },
  CacheKey: {
    session: (id: string) => `session:${id}`,
  },
}));

import { isSessionId, extractSessionId, resolveSession } from '#lib/session.js';

describe('session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isSessionId', () => {
    it('accepts a valid UUID v4', () => {
      expect(isSessionId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('accepts uppercase UUID v4', () => {
      expect(isSessionId('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('rejects a raw Discord access token', () => {
      // Discord tokens are base64-like strings, not UUIDs
      expect(isSessionId('mfa.VkO_2VtBe0e123456789abcdef')).toBe(false);
    });

    it('rejects an empty string', () => {
      expect(isSessionId('')).toBe(false);
    });

    it('rejects UUID v1 (version digit must be 4)', () => {
      // UUID v1 has version 1 in the third group
      expect(isSessionId('550e8400-e29b-11d4-a716-446655440000')).toBe(false);
    });

    it('rejects UUID with invalid variant bits', () => {
      // Variant bits [89ab] - using 0 which is invalid
      expect(isSessionId('550e8400-e29b-41d4-0716-446655440000')).toBe(false);
    });

    it('rejects malformed UUID (missing dashes)', () => {
      expect(isSessionId('550e8400e29b41d4a716446655440000')).toBe(false);
    });

    it('rejects UUID with extra characters', () => {
      expect(isSessionId('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false);
    });
  });

  describe('extractSessionId', () => {
    it('extracts session ID from DASHBOARD_AUTH cookie', () => {
      const request = {
        headers: {
          cookie: 'DASHBOARD_AUTH=550e8400-e29b-41d4-a716-446655440000; other=value',
        },
      } as any;

      expect(extractSessionId(request)).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('extracts session ID from Authorization Bearer header', () => {
      const request = {
        headers: {
          authorization: 'Bearer 550e8400-e29b-41d4-a716-446655440000',
        },
      } as any;

      expect(extractSessionId(request)).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('returns null when no session present', () => {
      const request = { headers: {} } as any;

      expect(extractSessionId(request)).toBeNull();
    });

    it('prefers cookie over Authorization header', () => {
      const request = {
        headers: {
          cookie: 'DASHBOARD_AUTH=cookie-session-id',
          authorization: 'Bearer header-session-id',
        },
      } as any;

      expect(extractSessionId(request)).toBe('cookie-session-id');
    });

    it('falls back to Authorization header when no cookie', () => {
      const request = {
        headers: {
          cookie: 'other=value',
          authorization: 'Bearer fallback-id',
        },
      } as any;

      expect(extractSessionId(request)).toBe('fallback-id');
    });

    it('returns null for Authorization header without Bearer prefix', () => {
      const request = {
        headers: {
          authorization: 'Basic credentials',
        },
      } as any;

      expect(extractSessionId(request)).toBeNull();
    });
  });

  describe('resolveSession', () => {
    const NOW = 1700000000000; // Fixed timestamp for deterministic tests

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const validSession = {
      accessToken: 'encrypted-token',
      refreshToken: 'encrypted-refresh',
      userId: 'user-123',
      createdAt: new Date(NOW - 1000).toISOString(),
      expiresAt: new Date(NOW + 3600_000).toISOString(), // 1 hour from now
    };

    it('returns decrypted session data for valid session', async () => {
      const decrypted = { ...validSession, accessToken: 'real-token' };
      mockGetJson.mockResolvedValue(validSession);
      mockDecryptSessionData.mockReturnValue(decrypted);

      const result = await resolveSession('550e8400-e29b-41d4-a716-446655440000');

      expect(mockGetJson).toHaveBeenCalledWith(
        'session:550e8400-e29b-41d4-a716-446655440000',
        expect.anything()
      );
      expect(mockDecryptSessionData).toHaveBeenCalledWith(validSession);
      expect(result).toEqual(decrypted);
    });

    it('returns null when session does not exist in Redis', async () => {
      mockGetJson.mockResolvedValue(null);

      const result = await resolveSession('nonexistent-id');

      expect(result).toBeNull();
    });

    it('returns null when session is expired', async () => {
      const expiredSession = {
        ...validSession,
        expiresAt: new Date(NOW - 60_000).toISOString(), // expired 1 minute ago
      };
      mockGetJson.mockResolvedValue(expiredSession);

      const result = await resolveSession('expired-session');

      expect(result).toBeNull();
      expect(mockDecryptSessionData).not.toHaveBeenCalled();
    });

    it('allows session within 30-second clock skew tolerance', async () => {
      // Session expired 15 seconds ago, but within 30s tolerance
      const nearlyExpired = {
        ...validSession,
        expiresAt: new Date(NOW - 15_000).toISOString(),
      };
      const decrypted = { ...nearlyExpired, accessToken: 'real-token' };
      mockGetJson.mockResolvedValue(nearlyExpired);
      mockDecryptSessionData.mockReturnValue(decrypted);

      const result = await resolveSession('nearly-expired');

      expect(result).toEqual(decrypted);
    });

    it('rejects session at exact clock skew boundary (30s)', async () => {
      // Expired exactly 30 seconds ago - should be rejected
      // expiresAt + 30000 <= now → expired
      const atBoundary = {
        ...validSession,
        expiresAt: new Date(NOW - 30_000).toISOString(),
      };
      mockGetJson.mockResolvedValue(atBoundary);

      const result = await resolveSession('boundary-session');

      expect(result).toBeNull();
    });

    it('accepts session just inside clock skew boundary', async () => {
      // Expired 29 seconds ago - within 30s tolerance
      const justInside = {
        ...validSession,
        expiresAt: new Date(NOW - 29_000).toISOString(),
      };
      const decrypted = { ...justInside, accessToken: 'real-token' };
      mockGetJson.mockResolvedValue(justInside);
      mockDecryptSessionData.mockReturnValue(decrypted);

      const result = await resolveSession('just-inside');

      expect(result).toEqual(decrypted);
    });

    it('rejects session with unparseable expiresAt (NaN)', async () => {
      const nanExpirySession = {
        ...validSession,
        expiresAt: 'not-a-date',
      };
      mockGetJson.mockResolvedValue(nanExpirySession);

      const result = await resolveSession('nan-expiry-session');

      expect(result).toBeNull();
      expect(mockDecryptSessionData).not.toHaveBeenCalled();
    });

    it('rejects when getJson throws (Redis failure)', async () => {
      mockGetJson.mockRejectedValue(new Error('Redis connection failed'));

      await expect(resolveSession('redis-fail-session')).rejects.toThrow('Redis connection failed');
    });
  });
});
