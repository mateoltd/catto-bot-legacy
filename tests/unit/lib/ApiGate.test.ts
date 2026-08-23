import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ALL mocks must be hoisted since vi.mock factories are hoisted to top
const {
  mockExtractSessionId,
  mockIsSessionId,
  mockResolveSession,
  mockCheckCommandAccess,
  mockCheckResourceAccess,
  mockRateLimitCheck,
  mockWeightCheck,
  mockGetOrSetJson,
  mockAxiosGet,
  mockMemberFetch,
  mockPrismaModEventCreate,
  mockGuildsCache,
} = vi.hoisted(() => ({
  mockExtractSessionId: vi.fn(),
  mockIsSessionId: vi.fn(),
  mockResolveSession: vi.fn(),
  mockCheckCommandAccess: vi.fn(),
  mockCheckResourceAccess: vi.fn(),
  mockRateLimitCheck: vi.fn(),
  mockWeightCheck: vi.fn(),
  mockGetOrSetJson: vi.fn(),
  mockAxiosGet: vi.fn(),
  mockMemberFetch: vi.fn(),
  mockPrismaModEventCreate: vi.fn(),
  mockGuildsCache: new Map<string, any>(),
}));

vi.mock('#lib/session.js', () => ({
  extractSessionId: mockExtractSessionId,
  isSessionId: mockIsSessionId,
  resolveSession: mockResolveSession,
}));

vi.mock('#lib/validation/permissionResolver.js', () => ({
  checkCommandAccess: mockCheckCommandAccess,
  checkResourceAccess: mockCheckResourceAccess,
}));

vi.mock('#lib/validation/RateLimitGate.js', () => ({
  RateLimitGate: {
    check: mockRateLimitCheck,
    LIMITS: {
      'evidence.view': { maxRequests: 60, windowMs: 60_000 },
    },
  },
}));

vi.mock('#lib/validation/WeightGate.js', () => ({
  WeightGate: {
    checkUploadWeight: mockWeightCheck,
  },
}));

vi.mock('#lib/cache/typedCache.js', () => ({
  getOrSetJson: mockGetOrSetJson,
  CacheKey: {
    discordUser: (hash: string) => `discord:user:${hash}`,
  },
}));

vi.mock('axios', () => ({
  default: {
    get: mockAxiosGet,
  },
}));

vi.mock('@sapphire/framework', async () => {
  const actual = await vi.importActual('@sapphire/framework');
  return {
    ...actual,
    container: {
      client: {
        guilds: {
          cache: mockGuildsCache,
        },
      },
      prisma: {
        modEvent: {
          create: mockPrismaModEventCreate,
        },
      },
      logger: {
        debug: vi.fn(),
        error: vi.fn(),
      },
    },
  };
});

import { ApiGate } from '#lib/validation/ApiGate.js';

// Helper to create a mock GuildMember
function createMockMember(overrides: { id?: string; isAdmin?: boolean } = {}) {
  return {
    id: overrides.id ?? 'user-123',
    permissions: {
      has: vi.fn((perm: string) => overrides.isAdmin === true && perm === 'Administrator'),
    },
  };
}

// Helper to set up a working ApiGate.fromRequest scenario
function setupValidSession(userId = 'user-123', isAdmin = false) {
  const member = createMockMember({ id: userId, isAdmin });
  const guild = {
    id: 'guild-1',
    ownerId: 'owner-999',
    members: { fetch: mockMemberFetch },
  };

  mockGuildsCache.set('guild-1', guild);
  mockMemberFetch.mockResolvedValue(member);
  mockIsSessionId.mockReturnValue(true);
  mockResolveSession.mockResolvedValue({ userId, accessToken: 'token' });

  return { member, guild };
}

describe('ApiGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuildsCache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fromRequest', () => {
    it('returns null when no session value is extracted', async () => {
      mockExtractSessionId.mockReturnValue(null);

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');

      expect(gate).toBeNull();
    });

    it('returns null when session ID resolves to null (expired)', async () => {
      mockExtractSessionId.mockReturnValue('550e8400-e29b-41d4-a716-446655440000');
      mockIsSessionId.mockReturnValue(true);
      mockResolveSession.mockResolvedValue(null);

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');

      expect(gate).toBeNull();
    });

    it('returns null when guild is not in bot cache', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      mockIsSessionId.mockReturnValue(true);
      mockResolveSession.mockResolvedValue({ userId: 'user-123' });
      // Guild not in cache

      const gate = await ApiGate.fromRequest({} as any, 'nonexistent-guild');

      expect(gate).toBeNull();
    });

    it('returns null when member fetch fails (user left/banned)', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession();
      mockMemberFetch.mockRejectedValue(new Error('Unknown Member'));

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');

      expect(gate).toBeNull();
    });

    it('creates ApiGate from valid session ID', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession('user-456');

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');

      expect(gate).not.toBeNull();
      expect(gate!.userId).toBe('user-456');
      expect(gate!.guildId).toBe('guild-1');
    });

    it('resolves legacy raw token via Discord API with cache', async () => {
      const member = createMockMember({ id: 'user-789' });
      const guild = {
        id: 'guild-1',
        ownerId: 'owner-999',
        members: { fetch: mockMemberFetch },
      };
      mockGuildsCache.set('guild-1', guild);
      mockMemberFetch.mockResolvedValue(member);

      mockExtractSessionId.mockReturnValue('raw-discord-token');
      mockIsSessionId.mockReturnValue(false);
      mockGetOrSetJson.mockResolvedValue({ id: 'user-789' });

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');

      expect(gate).not.toBeNull();
      expect(gate!.userId).toBe('user-789');
      expect(mockGetOrSetJson).toHaveBeenCalled();
    });

    it('falls back to direct Discord API when cache fails', async () => {
      const member = createMockMember({ id: 'user-abc' });
      const guild = {
        id: 'guild-1',
        ownerId: 'owner-999',
        members: { fetch: mockMemberFetch },
      };
      mockGuildsCache.set('guild-1', guild);
      mockMemberFetch.mockResolvedValue(member);

      mockExtractSessionId.mockReturnValue('raw-discord-token');
      mockIsSessionId.mockReturnValue(false);
      mockGetOrSetJson.mockRejectedValue(new Error('Redis unavailable'));
      mockAxiosGet.mockResolvedValue({ status: 200, data: { id: 'user-abc' } });

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');

      expect(gate).not.toBeNull();
      expect(gate!.userId).toBe('user-abc');
    });

    it('returns null when Discord API returns non-200 for raw token', async () => {
      mockExtractSessionId.mockReturnValue('invalid-raw-token');
      mockIsSessionId.mockReturnValue(false);
      mockGetOrSetJson.mockRejectedValue(new Error('Redis unavailable'));
      mockAxiosGet.mockResolvedValue({ status: 401, data: {} });

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');

      expect(gate).toBeNull();
    });

    it('returns null when getOrSetJson returns object without id field', async () => {
      const guild = {
        id: 'guild-1',
        ownerId: 'owner-999',
        members: { fetch: mockMemberFetch },
      };
      mockGuildsCache.set('guild-1', guild);

      mockExtractSessionId.mockReturnValue('raw-discord-token');
      mockIsSessionId.mockReturnValue(false);
      mockGetOrSetJson.mockResolvedValue({}); // No id field

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');

      expect(gate).toBeNull();
    });
  });

  describe('checkAuth', () => {
    it('grants admin bypass for any command key', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession('admin-user', true);

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');
      const result = await gate!.checkAuth('mod.evidence.view');

      expect(result.ok).toBe(true);
      expect(mockCheckCommandAccess).not.toHaveBeenCalled();
    });

    it('checks command-level permissions for non-admin', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      const { member } = setupValidSession('regular-user', false);
      mockCheckCommandAccess.mockResolvedValue({ allowed: true, reason: 'explicit_allow' });

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');
      const result = await gate!.checkAuth('mod.evidence.view');

      expect(result.ok).toBe(true);
      expect(mockCheckCommandAccess).toHaveBeenCalledWith(member, 'mod.evidence.view');
    });

    it('rejects users without required permission', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession('noob-user', false);
      mockCheckCommandAccess.mockResolvedValue({ allowed: false, reason: 'public' });

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');
      const result = await gate!.checkAuth('mod.evidence.view');

      expect(result.ok).toBe(false);
      expect(result.code).toBe('NO_PERMISSION');
    });

    it('returns EXPLICIT_DENY code for explicit denials', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession('denied-user', false);
      mockCheckCommandAccess.mockResolvedValue({ allowed: false, reason: 'explicit_deny' });

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');
      const result = await gate!.checkAuth('mod.evidence.view');

      expect(result.ok).toBe(false);
      expect(result.code).toBe('EXPLICIT_DENY');
    });

    it('returns EXPLICIT_DENY code for category_deny reason', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession('category-denied-user', false);
      mockCheckCommandAccess.mockResolvedValue({ allowed: false, reason: 'category_deny' });

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');
      const result = await gate!.checkAuth('mod.evidence.view');

      expect(result.ok).toBe(false);
      expect(result.code).toBe('EXPLICIT_DENY');
    });
  });

  describe('checkResourceAuth', () => {
    it('grants admin bypass for resource auth', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession('admin-user', true);

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');
      const result = await gate!.checkResourceAuth('mod.evidence.view', { caseId: 'case-1' });

      expect(result.ok).toBe(true);
      expect(mockCheckResourceAccess).not.toHaveBeenCalled();
    });

    it('checks resource access for non-admin', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      const { member } = setupValidSession('regular-user', false);
      mockCheckResourceAccess.mockResolvedValue({ allowed: true });

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');
      const context = { caseId: 'case-1' };
      const result = await gate!.checkResourceAuth('mod.evidence.view', context);

      expect(result.ok).toBe(true);
      expect(mockCheckResourceAccess).toHaveBeenCalledWith(member, 'mod.evidence.view', context);
    });

    it('rejects non-owner access to restricted resources', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession('other-user', false);
      mockCheckResourceAccess.mockResolvedValue({
        allowed: false,
        metadata: { disabledReason: 'Not the case owner' },
      });

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');
      const result = await gate!.checkResourceAuth('mod.evidence.edit', {
        caseId: 'case-1',
        ownerId: 'someone-else',
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('INSUFFICIENT_SCOPE');
    });
  });

  describe('checkRateLimit', () => {
    it('passes when under rate limit', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession();
      mockRateLimitCheck.mockResolvedValue({ allowed: true, remaining: 59 });

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');
      const options = { maxRequests: 60, windowMs: 60000 };
      const result = await gate!.checkRateLimit('evidence.view', options);

      expect(result.ok).toBe(true);
      expect(mockRateLimitCheck).toHaveBeenCalledWith('user-123', 'evidence.view', options);
    });

    it('returns rate limit exceeded with retryAfterMs', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession();
      mockRateLimitCheck.mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 15000 });

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');
      const result = await gate!.checkRateLimit('evidence.view', { maxRequests: 60, windowMs: 60000 });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('RATE_LIMITED');
      expect(result.metadata?.retryAfterMs).toBe(15000);
    });
  });

  describe('checkWeight', () => {
    it('passes when upload within weight limit', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession();
      mockWeightCheck.mockResolvedValue({ allowed: true, used: 0, max: 2_000_000_000 });

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');
      const result = await gate!.checkWeight('evidence.upload', 1024);

      expect(result.ok).toBe(true);
      expect(mockWeightCheck).toHaveBeenCalledWith('user-123', 'guild-1', 1024, undefined);
    });

    it('rejects when upload exceeds weight limit', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession();
      mockWeightCheck.mockResolvedValue({ allowed: false, used: 1_900_000_000, max: 2_000_000_000 });

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');
      const result = await gate!.checkWeight('evidence.upload', 200_000_000);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('WEIGHT_EXCEEDED');
      expect(result.metadata?.weightUsed).toBe(1_900_000_000);
      expect(result.metadata?.weightMax).toBe(2_000_000_000);
    });
  });

  describe('requireAll', () => {
    it('passes when all checks pass', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession('user-1', false); // non-admin so auth check is exercised
      mockCheckCommandAccess.mockResolvedValue({ allowed: true, reason: 'explicit_allow' });
      mockRateLimitCheck.mockResolvedValue({ allowed: true, remaining: 10 });

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');

      const result = await gate!.requireAll([
        { type: 'auth', commandKey: 'mod.evidence.view' },
        { type: 'rate_limit', actionKey: 'evidence.view', rateLimitOptions: { maxRequests: 60, windowMs: 60000 } },
      ]);

      expect(result.ok).toBe(true);
      expect(mockCheckCommandAccess).toHaveBeenCalled();
      expect(mockRateLimitCheck).toHaveBeenCalled();
    });

    it('short-circuits on first failure', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession('user-1', false);
      mockCheckCommandAccess.mockResolvedValue({ allowed: false, reason: 'public' });

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');

      const result = await gate!.requireAll([
        { type: 'auth', commandKey: 'mod.evidence.view' },
        { type: 'rate_limit', actionKey: 'evidence.view', rateLimitOptions: { maxRequests: 60, windowMs: 60000 } },
      ]);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('NO_PERMISSION');
      // Rate limit check should not have been called
      expect(mockRateLimitCheck).not.toHaveBeenCalled();
    });
  });

  describe('isAdmin / isOwner', () => {
    it('isAdmin returns true for Administrator permission', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession('admin-user', true);

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');

      expect(gate!.isAdmin).toBe(true);
    });

    it('isAdmin returns false for regular user', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession('regular-user', false);

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');

      expect(gate!.isAdmin).toBe(false);
    });

    it('isOwner returns true when member ID matches guild owner', async () => {
      const member = createMockMember({ id: 'owner-999' });
      const guild = {
        id: 'guild-1',
        ownerId: 'owner-999',
        members: { fetch: mockMemberFetch },
      };
      mockGuildsCache.set('guild-1', guild);
      mockMemberFetch.mockResolvedValue(member);

      mockExtractSessionId.mockReturnValue('session-id');
      mockIsSessionId.mockReturnValue(true);
      mockResolveSession.mockResolvedValue({ userId: 'owner-999' });

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');

      expect(gate!.isOwner).toBe(true);
    });

    it('isOwner returns false for non-owner', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession('regular-user', false);

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');

      expect(gate!.isOwner).toBe(false);
    });
  });

  describe('logCheck', () => {
    it('logs successful checks to modEvent', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession();
      mockPrismaModEventCreate.mockResolvedValue({});

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');
      await gate!.logCheck('evidence.view', { ok: true });

      expect(mockPrismaModEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          guildId: 'guild-1',
          actorId: 'user-123',
          action: 'evidence.view',
          success: true,
        }),
      });
    });

    it('does not throw when logging fails', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession();
      mockPrismaModEventCreate.mockRejectedValue(new Error('DB error'));

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');

      // Should not throw
      await expect(gate!.logCheck('test', { ok: true })).resolves.toBeUndefined();
    });

    it('logs failed check result with errorType', async () => {
      mockExtractSessionId.mockReturnValue('session-id');
      setupValidSession();
      mockPrismaModEventCreate.mockResolvedValue({});

      const gate = await ApiGate.fromRequest({} as any, 'guild-1');
      const failedResult = { ok: false, code: 'NO_PERMISSION', message: 'Permission denied for mod.ban' };
      await gate!.logCheck('mod.ban', failedResult);

      expect(mockPrismaModEventCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          guildId: 'guild-1',
          actorId: 'user-123',
          action: 'mod.ban',
          success: false,
          errorType: 'NO_PERMISSION',
        }),
      });
    });
  });
});
