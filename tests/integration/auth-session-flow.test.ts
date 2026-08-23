/**
 * Auth/session flow integration tests.
 *
 * Tests the authentication chain from session extraction through middleware
 * to route access. Verifies session resolution, expiry handling, clock skew
 * tolerance, legacy token rejection, and OAuth bypass behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mocks ─

const {
  mockGetJson,
  mockDecryptSessionData,
  mockRedis,
} = vi.hoisted(() => ({
  mockGetJson: vi.fn(),
  mockDecryptSessionData: vi.fn(),
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    pipeline: vi.fn(() => ({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, 0],
        [null, 0],
        [null, 1],
        [null, 1],
      ]),
    })),
    zrange: vi.fn().mockResolvedValue([]),
    duplicate: vi.fn(),
  },
}));

vi.mock('#lib/cache/typedCache.js', () => ({
  getJson: mockGetJson,
  setJson: vi.fn(),
  getOrSetJson: vi.fn(),
  deleteJson: vi.fn(),
  CacheKey: {
    session: (id: string) => `session:${id}`,
    discordUser: (hash: string) => `discord:user:${hash}`,
    discordGuilds: (hash: string) => `discord:guilds:${hash}`,
  },
  SessionDataSchema: {
    parse: (v: unknown) => v,
    safeParse: (v: unknown) => ({ success: true, data: v }),
  },
  decryptSessionData: mockDecryptSessionData,
  encryptSessionData: vi.fn((data: unknown) => data),
}));

// Mock Sapphire framework (container with redis)
vi.mock('@sapphire/framework', () => ({
  container: {
    redis: mockRedis,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    },
    client: {
      guilds: {
        cache: new Map([
          ['guild-123', {
            id: 'guild-123',
            name: 'Test Guild',
            members: {
              fetch: vi.fn().mockResolvedValue({
                id: 'user-123',
                user: { tag: 'TestUser#1234', id: 'user-123' },
                permissions: { has: vi.fn().mockReturnValue(true) },
              }),
            },
          }],
        ]),
      },
    },
    prisma: {
      modEvent: { create: vi.fn() },
    },
  },
}));

// Mock the Middleware base class so we can instantiate
vi.mock('@sapphire/plugin-api', async () => {
  const actual = await vi.importActual('@sapphire/plugin-api');
  return {
    ...actual,
    Middleware: class MockMiddleware {
      constructor(_context: unknown, _options: unknown) {}
    },
  };
});

// ─── Imports (after mocks) 

import { extractSessionId, isSessionId } from '#lib/session.js';
import { AuthenticatedMiddleware } from '#root/middlewares/authenticated.js';

// ─── Helpers 

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function createMockApiRequest(overrides: {
  url?: string;
  headers?: Record<string, string>;
} = {}) {
  return {
    url: overrides.url ?? '/api/test',
    headers: overrides.headers ?? {},
  } as any;
}

function createMockApiResponse() {
  const mock: any = {
    statusCode: 200,
    data: null,
    json: vi.fn(function (this: any, data: unknown) {
      mock.data = data;
      return mock;
    }),
    status: vi.fn(function (this: any, code: number) {
      mock.statusCode = code;
      return mock;
    }),
  };
  return mock;
}

// ─── Tests ──

describe('Auth/session flow integration', () => {
  let middleware: AuthenticatedMiddleware;

  beforeEach(() => {
    middleware = new AuthenticatedMiddleware({} as any, {} as any);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. Valid session → successful route access ─────

  describe('Valid session → successful route access', () => {
    it('cookie with valid session ID resolves user and allows access', async () => {
      const sessionData = {
        userId: 'user-123',
        accessToken: 'encrypted-token',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      };
      mockGetJson.mockResolvedValue(sessionData);
      mockDecryptSessionData.mockReturnValue({
        ...sessionData,
        accessToken: 'decrypted-token',
      });

      const request = createMockApiRequest({
        headers: { cookie: `DASHBOARD_AUTH=${VALID_UUID}` },
      });
      const response = createMockApiResponse();

      await middleware.run(request, response);

      // Middleware should pass through (no status set)
      expect(response.status).not.toHaveBeenCalled();
      expect(response.json).not.toHaveBeenCalled();
      expect(response.statusCode).toBe(200);
    });
  });

  // ─── 2. Expired session → 401 + SessionExpired ─────

  describe('Expired session → 401 + SessionExpired', () => {
    it('session with past expiresAt is rejected', async () => {
      const expiredSession = {
        userId: 'user-123',
        accessToken: 'encrypted-token',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 120_000).toISOString(), // 2 min ago
      };
      mockGetJson.mockResolvedValue(expiredSession);
      // resolveSession checks expiry and should return null for expired

      const request = createMockApiRequest({
        headers: { cookie: `DASHBOARD_AUTH=${VALID_UUID}` },
      });
      const response = createMockApiResponse();

      await middleware.run(request, response);

      expect(response.statusCode).toBe(401);
      expect(response.data.error).toBe('SessionExpired');
    });
  });

  // ─── 3. NaN expiresAt → rejected 

  describe('NaN expiresAt → rejected', () => {
    it('session with garbage expiresAt is rejected', async () => {
      const badSession = {
        userId: 'user-123',
        accessToken: 'encrypted-token',
        createdAt: new Date().toISOString(),
        expiresAt: 'garbage-not-a-date',
      };
      mockGetJson.mockResolvedValue(badSession);

      const request = createMockApiRequest({
        headers: { cookie: `DASHBOARD_AUTH=${VALID_UUID}` },
      });
      const response = createMockApiResponse();

      await middleware.run(request, response);

      expect(response.statusCode).toBe(401);
      expect(response.data.error).toBe('SessionExpired');
    });
  });

  // ─── 4. Clock skew tolerance ───

  describe('Clock skew tolerance', () => {
    it('session expired 15s ago (within 30s tolerance) is still allowed', async () => {
      const sessionData = {
        userId: 'user-123',
        accessToken: 'encrypted-token',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 15_000).toISOString(), // 15s ago
      };
      mockGetJson.mockResolvedValue(sessionData);
      mockDecryptSessionData.mockReturnValue({
        ...sessionData,
        accessToken: 'decrypted-token',
      });

      const request = createMockApiRequest({
        headers: { cookie: `DASHBOARD_AUTH=${VALID_UUID}` },
      });
      const response = createMockApiResponse();

      await middleware.run(request, response);

      // Should pass through — within tolerance
      expect(response.status).not.toHaveBeenCalled();
      expect(response.statusCode).toBe(200);
    });
  });

  // ─── 5. Clock skew boundary 

  describe('Clock skew boundary', () => {
    it('session expired exactly 30s ago is rejected', async () => {
      const sessionData = {
        userId: 'user-123',
        accessToken: 'encrypted-token',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 30_000).toISOString(), // Exactly 30s ago
      };
      mockGetJson.mockResolvedValue(sessionData);

      const request = createMockApiRequest({
        headers: { cookie: `DASHBOARD_AUTH=${VALID_UUID}` },
      });
      const response = createMockApiResponse();

      await middleware.run(request, response);

      // The condition is: expiresAt + 30_000 <= now
      // expiresAt = now - 30_000, so expiresAt + 30_000 = now, which means <= now is true
      expect(response.statusCode).toBe(401);
      expect(response.data.error).toBe('SessionExpired');
    });
  });

  // ─── 6. Legacy raw token → SessionExpired ───

  describe('Legacy raw token → SessionExpired', () => {
    it('non-UUID token is rejected with SessionExpired', async () => {
      const request = createMockApiRequest({
        headers: { cookie: 'DASHBOARD_AUTH=mfa.raw-discord-access-token-value' },
      });
      const response = createMockApiResponse();

      await middleware.run(request, response);

      expect(response.statusCode).toBe(401);
      expect(response.data.error).toBe('SessionExpired');
      expect(response.data.message).toContain('expired');
    });
  });

  // ─── 7. OAuth path bypass ─

  describe('OAuth path bypass', () => {
    it('request to /api/oauth/callback skips auth entirely', async () => {
      const request = createMockApiRequest({ url: '/api/oauth/callback' });
      const response = createMockApiResponse();

      await middleware.run(request, response);

      // No session resolution attempted
      expect(mockGetJson).not.toHaveBeenCalled();
      expect(response.statusCode).toBe(200);
    });

    it('request to /api/oauth/login skips auth', async () => {
      const request = createMockApiRequest({ url: '/api/oauth/login' });
      const response = createMockApiResponse();

      await middleware.run(request, response);

      expect(response.statusCode).toBe(200);
    });
  });

  // ─── 8. OAuth bypass does NOT apply to query string ─

  describe('OAuth bypass does NOT apply to query string', () => {
    it('/api/test?redirect=/oauth/callback enforces auth', async () => {
      const request = createMockApiRequest({
        url: '/api/test?redirect=/oauth/callback',
      });
      const response = createMockApiResponse();

      await middleware.run(request, response);

      // Auth is enforced because /oauth/ is only in the query string
      expect(response.statusCode).toBe(401);
    });
  });

  // ─── 9. Missing session → 401 Unauthorized ─

  describe('Missing session → 401 Unauthorized', () => {
    it('no cookie, no Authorization header → 401', async () => {
      const request = createMockApiRequest();
      const response = createMockApiResponse();

      await middleware.run(request, response);

      expect(response.statusCode).toBe(401);
      expect(response.data.error).toBe('Unauthorized');
      expect(response.data.message).toContain('logged in');
    });
  });

  // ─── 10. Session from Authorization header ──

  describe('Session from Authorization header', () => {
    it('Bearer header with valid UUID session resolves correctly', async () => {
      const sessionData = {
        userId: 'user-456',
        accessToken: 'encrypted-bearer-token',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      };
      mockGetJson.mockResolvedValue(sessionData);
      mockDecryptSessionData.mockReturnValue({
        ...sessionData,
        accessToken: 'decrypted-bearer-token',
      });

      const request = createMockApiRequest({
        headers: { authorization: `Bearer ${VALID_UUID}` },
      });
      const response = createMockApiResponse();

      await middleware.run(request, response);

      expect(response.status).not.toHaveBeenCalled();
      expect(response.statusCode).toBe(200);
    });
  });

  // ─── 11. Session not found in Redis → 401 ──

  describe('Session not found in Redis', () => {
    it('valid UUID format but no session in Redis returns SessionExpired', async () => {
      mockGetJson.mockResolvedValue(null);

      const request = createMockApiRequest({
        headers: { cookie: `DASHBOARD_AUTH=${VALID_UUID}` },
      });
      const response = createMockApiResponse();

      await middleware.run(request, response);

      expect(response.statusCode).toBe(401);
      expect(response.data.error).toBe('SessionExpired');
    });
  });

  // ─── Session utility functions ─

  describe('Session utility functions', () => {
    it('extractSessionId extracts from cookie', () => {
      const request = {
        headers: { cookie: 'DASHBOARD_AUTH=my-session-id; other=value' },
      } as any;
      expect(extractSessionId(request)).toBe('my-session-id');
    });

    it('extractSessionId extracts from Authorization Bearer header', () => {
      const request = {
        headers: { authorization: 'Bearer my-bearer-token' },
      } as any;
      expect(extractSessionId(request)).toBe('my-bearer-token');
    });

    it('extractSessionId returns null when neither cookie nor header exists', () => {
      const request = { headers: {} } as any;
      expect(extractSessionId(request)).toBeNull();
    });

    it('extractSessionId prefers cookie over Authorization header', () => {
      const request = {
        headers: {
          cookie: 'DASHBOARD_AUTH=cookie-value',
          authorization: 'Bearer bearer-value',
        },
      } as any;
      expect(extractSessionId(request)).toBe('cookie-value');
    });

    it('isSessionId returns true for valid UUID v4', () => {
      expect(isSessionId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('isSessionId returns false for non-UUID strings', () => {
      expect(isSessionId('mfa.raw-discord-token')).toBe(false);
      expect(isSessionId('not-a-uuid')).toBe(false);
      expect(isSessionId('')).toBe(false);
    });
  });
});
