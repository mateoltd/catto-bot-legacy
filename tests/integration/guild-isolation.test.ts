/**
 * Cross-guild isolation integration tests.
 *
 * Verifies that each moderation route properly scopes queries to the
 * requesting guild and cannot leak data across guilds.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModerationCasesRoute } from '#routes/guilds/moderation/cases/index.js';
import { EvidenceRoute } from '#routes/guilds/moderation/evidence/index.js';
import { ModerationUsersRoute } from '#routes/guilds/moderation/users/index.js';
import { EvidenceDetailRoute } from '#routes/guilds/moderation/evidence/[evidenceId].js';
import {
  createMockRequest,
  createMockResponse,
  createMockContainer,
  expectStatus,
} from '../helpers/test-helpers.js';

// ─── Hoisted mocks ─

const {
  mockApiGateFromRequest,
  mockEvidenceService,
  mockAccessLogService,
  mockWatermarkService,
  mockParseRequestBody,
  mockFetchOGData,
  mockAnalyticsService,
  mockValidateDto,
} = vi.hoisted(() => ({
  mockApiGateFromRequest: vi.fn(),
  mockEvidenceService: {
    getEvidenceForCase: vi.fn(),
    getEvidenceSummary: vi.fn(),
    getEvidenceForGuild: vi.fn(),
    searchEvidence: vi.fn(),
    initiateUpload: vi.fn(),
    confirmUpload: vi.fn(),
    addUrlEvidence: vi.fn(),
    amendEvidence: vi.fn(),
    getEvidenceById: vi.fn(),
    generateViewUrl: vi.fn(),
    generateDownloadUrl: vi.fn(),
    getEvidenceHistory: vi.fn(),
    addTimestamp: vi.fn(),
    removeTimestamp: vi.fn(),
  },
  mockAccessLogService: {
    logAccess: vi.fn(),
    getAccessLog: vi.fn(),
  },
  mockWatermarkService: {
    getWatermarkedUrl: vi.fn(),
  },
  mockParseRequestBody: vi.fn(),
  mockFetchOGData: vi.fn(),
  mockAnalyticsService: {
    getAnalytics: vi.fn(),
    getCaseAnalytics: vi.fn(),
  },
  mockValidateDto: vi.fn(),
}));

// ─── Module mocks 

vi.mock('#lib/validation/ApiGate.js', () => ({
  ApiGate: { fromRequest: mockApiGateFromRequest },
}));

vi.mock('#lib/validation/RateLimitGate.js', () => ({
  RateLimitGate: {
    LIMITS: {
      'evidence.upload': { maxRequests: 10, windowMs: 60_000 },
      'evidence.view': { maxRequests: 60, windowMs: 60_000 },
    },
  },
}));

vi.mock('#modules/moderation/services/EvidenceService.js', () => ({
  evidenceService: mockEvidenceService,
}));

vi.mock('#modules/moderation/services/AccessLogService.js', () => ({
  accessLogService: mockAccessLogService,
}));

vi.mock('#modules/moderation/services/WatermarkService.js', () => ({
  watermarkService: mockWatermarkService,
}));

vi.mock('#modules/moderation/services/AnalyticsService.js', () => ({
  analyticsService: mockAnalyticsService,
}));

vi.mock('#lib/route-utils.js', () => ({
  parseRequestBody: mockParseRequestBody,
}));

vi.mock('#lib/utils/ogFetcher.js', () => ({
  fetchOGData: mockFetchOGData,
}));

vi.mock('#config.js', () => ({
  CONFIG: {
    MAX_EVIDENCE_UPLOAD_BYTES: 100_000_000,
  },
}));

vi.mock('#lib/validation/modAction.js', () => ({
  parseModAction: vi.fn((action: string) => {
    const valid = ['BAN', 'KICK', 'WARN', 'TIMEOUT', 'MUTE', 'UNMUTE', 'UNBAN'];
    return valid.includes(action) ? action : undefined;
  }),
}));

vi.mock('#lib/validation/validate-dto.js', () => ({
  validateDto: mockValidateDto,
}));

vi.mock('#lib/dtos/moderation/moderation-config.dto.js', () => ({
  UpdateModConfigDto: class UpdateModConfigDto {},
}));

// ─── Helpers 

const GUILD_A = 'guild-A';
const GUILD_B = 'guild-B';

function createMockGate() {
  return {
    userId: 'user-123',
    member: { user: { tag: 'TestUser#1234' } },
    checkAuth: vi.fn().mockResolvedValue({ ok: true }),
    checkRateLimit: vi.fn().mockResolvedValue({ ok: true }),
    checkResourceAuth: vi.fn().mockResolvedValue({ ok: true }),
    checkWeight: vi.fn().mockResolvedValue({ ok: true }),
  };
}

/** Build a container whose guild cache contains both Guild A and Guild B. */
function createDualGuildContainer() {
  const guildA = {
    id: GUILD_A,
    name: 'Guild A',
    members: { cache: new Map() },
    channels: {
      cache: new Map([['ch-a', { id: 'ch-a', isTextBased: () => true }]]),
    },
    roles: {
      cache: new Map([['role-a', { id: 'role-a', name: 'Muted' }]]),
    },
  };

  const guildB = {
    id: GUILD_B,
    name: 'Guild B',
    members: { cache: new Map() },
    channels: {
      cache: new Map([['ch-b', { id: 'ch-b', isTextBased: () => true }]]),
    },
    roles: {
      cache: new Map([['role-b', { id: 'role-b', name: 'Muted' }]]),
    },
  };

  const guildsCache = new Map([
    [GUILD_A, guildA],
    [GUILD_B, guildB],
  ]);

  return createMockContainer({
    client: {
      guilds: { cache: guildsCache },
      users: { cache: new Map() },
    } as any,
  });
}

// ─── Tests ──

describe('Cross-guild isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 1. Cases route 

  describe('Cases route: findMany scoped to guildId', () => {
    it('Guild A request only returns Guild A cases (findMany where includes guildId)', async () => {
      mockApiGateFromRequest.mockResolvedValue(createMockGate());

      const mockModCaseCount = vi.fn().mockResolvedValue(2);
      const mockModCaseFindMany = vi.fn().mockResolvedValue([
        { id: 'case-1', caseNumber: 1, action: 'WARN', guildId: GUILD_A },
      ]);

      const container = createDualGuildContainer();
      (container as any).prisma = {
        modCase: {
          count: mockModCaseCount,
          findMany: mockModCaseFindMany,
        },
      };

      const route = Object.create(ModerationCasesRoute.prototype);
      Object.defineProperty(route, 'container', {
        get: () => container,
        configurable: true,
      });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);

      // Both count and findMany must be scoped to Guild A
      expect(mockModCaseCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ guildId: GUILD_A }),
        }),
      );
      expect(mockModCaseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ guildId: GUILD_A }),
        }),
      );

      // Verify Guild B is never referenced
      const countCallArgs = JSON.stringify(mockModCaseCount.mock.calls);
      const findManyCallArgs = JSON.stringify(mockModCaseFindMany.mock.calls);
      expect(countCallArgs).not.toContain(GUILD_B);
      expect(findManyCallArgs).not.toContain(GUILD_B);
    });
  });

  // ─── 2. Evidence route ─────

  describe('Evidence route: getEvidenceForGuild scoped to guildId', () => {
    it('Guild A request scopes getEvidenceForGuild to Guild A guildId', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockEvidenceService.getEvidenceForGuild.mockResolvedValue({
        evidence: [{ id: 'ev-1', guildId: GUILD_A }],
        total: 1,
      });

      const container = createDualGuildContainer();
      const route = Object.create(EvidenceRoute.prototype);
      Object.defineProperty(route, 'container', {
        get: () => container,
        configurable: true,
      });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
        query: { page: '1', limit: '10' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(mockEvidenceService.getEvidenceForGuild).toHaveBeenCalledWith(
        GUILD_A,
        expect.anything(),
      );
      // First positional arg must be Guild A, not Guild B
      expect(mockEvidenceService.getEvidenceForGuild.mock.calls[0]![0]).toBe(GUILD_A);
    });
  });

  // ─── 3. Users route 

  describe('Users route: $queryRaw and stats scoped to guildId', () => {
    it('Guild A request scopes aggregate and userFlag.count to Guild A', async () => {
      const mockQueryRaw = vi.fn();
      const mockUserFlagGroupBy = vi.fn().mockResolvedValue([]);
      const mockModCaseGroupBy = vi.fn().mockResolvedValue([]);
      const mockUserModNoteGroupBy = vi.fn().mockResolvedValue([]);
      const mockModCaseAggregate = vi.fn().mockResolvedValue({ _count: { id: 0 } });
      const mockUserFlagCount = vi.fn().mockResolvedValue(0);

      // Empty user results
      mockQueryRaw.mockResolvedValueOnce([]); // users
      mockQueryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]); // total count
      mockQueryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]); // uniqueUsersTotal

      const container = createDualGuildContainer();
      (container as any).prisma = {
        $queryRaw: mockQueryRaw,
        userFlag: { groupBy: mockUserFlagGroupBy, count: mockUserFlagCount },
        modCase: { groupBy: mockModCaseGroupBy, aggregate: mockModCaseAggregate },
        userModNote: { groupBy: mockUserModNoteGroupBy },
      };

      const route = Object.create(ModerationUsersRoute.prototype);
      Object.defineProperty(route, 'container', {
        get: () => container,
        configurable: true,
      });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);

      // modCase.aggregate must be scoped to Guild A
      expect(mockModCaseAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { guildId: GUILD_A },
        }),
      );

      // userFlag.count must be scoped to Guild A
      expect(mockUserFlagCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ guildId: GUILD_A }),
        }),
      );

      // $queryRaw must have been called and scoped to Guild A
      expect(mockQueryRaw).toHaveBeenCalled();
      // Prisma tagged template literals pass interpolated values as subsequent args
      const firstCallArgs = mockQueryRaw.mock.calls[0]!;
      // The tagged template call args: [strings, ...values] — guildId is the first interpolated value
      expect(firstCallArgs[1]).toBe(GUILD_A);

      // Verify Guild B is never referenced in stats calls
      const aggregateArgs = JSON.stringify(mockModCaseAggregate.mock.calls);
      const flagCountArgs = JSON.stringify(mockUserFlagCount.mock.calls);
      expect(aggregateArgs).not.toContain(GUILD_B);
      expect(flagCountArgs).not.toContain(GUILD_B);
    });
  });

  // ─── 4. Analytics route ────

  describe('Analytics route: analytics scoped to guildId', () => {
    it('Guild A request only gets Guild A analytics (evidence)', async () => {
      const { AnalyticsRoute } = await import('#routes/guilds/moderation/analytics.js');

      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockAnalyticsService.getAnalytics.mockResolvedValue({
        totalEvidence: 10,
        byType: { IMAGE: 10 },
      });

      const container = createDualGuildContainer();
      const route = Object.create(AnalyticsRoute.prototype);
      Object.defineProperty(route, 'container', {
        get: () => container,
        configurable: true,
      });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(mockAnalyticsService.getAnalytics).toHaveBeenCalledWith(GUILD_A, '30d');
      expect(mockAnalyticsService.getAnalytics).not.toHaveBeenCalledWith(
        GUILD_B,
        expect.anything(),
      );
    });

    it('Guild A case analytics are scoped to Guild A (type=cases)', async () => {
      const { AnalyticsRoute } = await import('#routes/guilds/moderation/analytics.js');

      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockAnalyticsService.getCaseAnalytics.mockResolvedValue({ totalCases: 5 });

      const container = createDualGuildContainer();
      const route = Object.create(AnalyticsRoute.prototype);
      Object.defineProperty(route, 'container', {
        get: () => container,
        configurable: true,
      });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
        query: { type: 'cases' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(mockAnalyticsService.getCaseAnalytics).toHaveBeenCalledWith(GUILD_A, '30d');
      expect(mockAnalyticsService.getCaseAnalytics).not.toHaveBeenCalledWith(
        GUILD_B,
        expect.anything(),
      );
    });
  });

  // ─── 5. Config route ─

  describe('Config route: reads/writes scoped to guildId', () => {
    it('Guild A GET only reads Guild A config (findUnique where guildId)', async () => {
      const { ModerationConfigRoute } = await import('#routes/guilds/moderation/config.js');

      const mockModConfigFindUnique = vi.fn().mockResolvedValue({
        guildId: GUILD_A,
        modLogChannelId: 'ch-a',
        autoModEnabled: true,
        watermarkDownloads: false,
        watermarkText: null,
      });
      const mockModConfigUpsert = vi.fn();

      const container = createDualGuildContainer();
      (container as any).prisma = {
        modConfig: {
          findUnique: mockModConfigFindUnique,
          upsert: mockModConfigUpsert,
        },
      };

      const route = Object.create(ModerationConfigRoute.prototype);
      Object.defineProperty(route, 'container', {
        get: () => container,
        configurable: true,
      });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(mockModConfigFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { guildId: GUILD_A },
        }),
      );
      const data = response.data as any;
      expect(data.guildId).toBe(GUILD_A);

      // findUnique must never be called with Guild B
      const findUniqueArgs = JSON.stringify(mockModConfigFindUnique.mock.calls);
      expect(findUniqueArgs).not.toContain(GUILD_B);
    });

    it('Guild A PUT only writes Guild A config (upsert where guildId)', async () => {
      const { ModerationConfigRoute } = await import('#routes/guilds/moderation/config.js');

      const mockModConfigFindUnique = vi.fn();
      const mockModConfigUpsert = vi.fn().mockResolvedValue({
        guildId: GUILD_A,
        autoModEnabled: true,
        watermarkDownloads: true,
      });

      const container = createDualGuildContainer();
      (container as any).prisma = {
        modConfig: {
          findUnique: mockModConfigFindUnique,
          upsert: mockModConfigUpsert,
        },
      };

      const route = Object.create(ModerationConfigRoute.prototype);
      Object.defineProperty(route, 'container', {
        get: () => container,
        configurable: true,
      });

      mockParseRequestBody.mockResolvedValue({ autoModEnabled: true });
      mockValidateDto.mockResolvedValue({
        success: true,
        data: { autoModEnabled: true },
      });

      const request = createMockRequest({
        method: 'PUT',
        params: { guildId: GUILD_A },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(mockModConfigUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { guildId: GUILD_A },
          create: expect.objectContaining({ guildId: GUILD_A }),
        }),
      );

      // upsert must never reference Guild B
      const upsertArgs = JSON.stringify(mockModConfigUpsert.mock.calls);
      expect(upsertArgs).not.toContain(GUILD_B);
    });
  });

  // ─── 6. Evidence detail route (access-log guild check) 

  describe('Evidence detail route: access-log checks evidence.guildId matches request guildId', () => {
    it('returns 404 when evidence.guildId is Guild B but request guildId is Guild A', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      // Evidence belongs to Guild B
      mockEvidenceService.getEvidenceById.mockResolvedValue({
        id: 'ev-cross-guild',
        guildId: GUILD_B,
      });

      const container = createDualGuildContainer();
      (container as any).prisma = {
        modConfig: { findUnique: vi.fn() },
      };

      const route = Object.create(EvidenceDetailRoute.prototype);
      Object.defineProperty(route, 'container', {
        get: () => container,
        configurable: true,
      });

      // Request from Guild A asking for evidence that belongs to Guild B
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A, evidenceId: 'ev-cross-guild' },
        query: { action: 'access-log' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 404);
      expect((response.data as any).error).toBe('Evidence not found');

      // Access log must NOT be fetched for cross-guild evidence
      expect(mockAccessLogService.getAccessLog).not.toHaveBeenCalled();
    });
  });

  // ─── 7. Evidence detail route: handleGetDetail guild check ──

  describe('Evidence detail route: handleGetDetail verifies guildId', () => {
    it('returns 404 when evidence belongs to Guild B but request is from Guild A', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      // Evidence belongs to Guild B
      mockEvidenceService.getEvidenceById.mockResolvedValue({
        id: 'ev-cross-guild',
        guildId: GUILD_B,
        fileName: 'leaked.png',
      });

      const container = createDualGuildContainer();
      (container as any).prisma = {
        modConfig: { findUnique: vi.fn() },
      };

      const route = Object.create(EvidenceDetailRoute.prototype);
      Object.defineProperty(route, 'container', {
        get: () => container,
        configurable: true,
      });

      // Request from Guild A, default detail action (no action param)
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A, evidenceId: 'ev-cross-guild' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 404);
      expect((response.data as any).error).toBe('Evidence not found');
    });
  });

  // ─── 8. Symmetric test: request as Guild B for Guild A data ─

  describe('Symmetric isolation: Guild B cannot access Guild A data', () => {
    it('Guild B request scopes findMany to Guild B, not Guild A', async () => {
      mockApiGateFromRequest.mockResolvedValue(createMockGate());

      const mockModCaseCount = vi.fn().mockResolvedValue(0);
      const mockModCaseFindMany = vi.fn().mockResolvedValue([]);

      const container = createDualGuildContainer();
      (container as any).prisma = {
        modCase: {
          count: mockModCaseCount,
          findMany: mockModCaseFindMany,
        },
      };

      const route = Object.create(ModerationCasesRoute.prototype);
      Object.defineProperty(route, 'container', {
        get: () => container,
        configurable: true,
      });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_B },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);

      // Both count and findMany must be scoped to Guild B
      expect(mockModCaseCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ guildId: GUILD_B }),
        }),
      );
      expect(mockModCaseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ guildId: GUILD_B }),
        }),
      );

      // Verify Guild A is never referenced
      const countCallArgs = JSON.stringify(mockModCaseCount.mock.calls);
      const findManyCallArgs = JSON.stringify(mockModCaseFindMany.mock.calls);
      expect(countCallArgs).not.toContain(GUILD_A);
      expect(findManyCallArgs).not.toContain(GUILD_A);
    });
  });
});
