/**
 * Case-evidence flow integration tests.
 *
 * Tests cross-service interactions between cases and evidence:
 * case listing with filters, evidence scoping per case, pagination,
 * guild-scoped case numbers, and sort ordering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModerationCasesRoute } from '#routes/guilds/moderation/cases/index.js';
import { EvidenceRoute } from '#routes/guilds/moderation/evidence/index.js';
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
  mockParseRequestBody,
  mockFetchOGData,
  mockParseModAction,
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
  mockParseRequestBody: vi.fn(),
  mockFetchOGData: vi.fn(),
  mockParseModAction: vi.fn((action: string) => {
    const valid = ['BAN', 'KICK', 'WARN', 'TIMEOUT', 'MUTE', 'UNMUTE', 'UNBAN'];
    return valid.includes(action) ? action : undefined;
  }),
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
  accessLogService: { logAccess: vi.fn(), getAccessLog: vi.fn() },
}));

vi.mock('#modules/moderation/services/WatermarkService.js', () => ({
  watermarkService: { getWatermarkedUrl: vi.fn() },
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
  parseModAction: mockParseModAction,
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

function createCasesRoute(guildIds: string[] = [GUILD_A]) {
  const guildsCache = new Map(
    guildIds.map((id) => [id, { id, name: `Guild ${id}` }]),
  );
  const container = createMockContainer({
    client: { guilds: { cache: guildsCache } } as any,
  });
  (container as any).prisma = {
    modCase: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  };
  const route = Object.create(ModerationCasesRoute.prototype);
  Object.defineProperty(route, 'container', { get: () => container, configurable: true });
  return { route, container, prisma: (container as any).prisma };
}

function createEvidenceRoute() {
  const container = createMockContainer();
  const route = Object.create(EvidenceRoute.prototype);
  Object.defineProperty(route, 'container', { get: () => container, configurable: true });
  return { route, container };
}

function makeCase(overrides?: Record<string, unknown>) {
  return {
    id: 'case-uuid-1',
    guildId: GUILD_A,
    caseNumber: 1,
    action: 'WARN',
    status: 'ACTIVE',
    targetId: 'target-1',
    targetTag: 'Target#0001',
    moderatorId: 'mod-1',
    moderatorTag: 'Mod#0001',
    reason: 'Test reason',
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
    ...overrides,
  };
}

// ─── Tests ──

describe('Case-evidence flow integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated with access (cases route now requires ApiGate)
    mockApiGateFromRequest.mockResolvedValue(createMockGate());
  });

  // ─── 1. Case with evidence 

  describe('Case with evidence', () => {
    it('creates a case, uploads evidence, and lists evidence scoped to that case', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      // Step 1: List cases to see case #1 exists
      const { route: casesRoute, prisma } = createCasesRoute();
      const case1 = makeCase({ caseNumber: 1 });
      prisma.modCase.count.mockResolvedValue(1);
      prisma.modCase.findMany.mockResolvedValue([case1]);

      const caseListReq = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
      });
      const caseListRes = createMockResponse();
      await casesRoute.run(caseListReq, caseListRes as any);

      expectStatus(caseListRes, 200);
      expect((caseListRes.data as any).cases).toHaveLength(1);
      expect((caseListRes.data as any).cases[0].caseNumber).toBe(1);

      // Step 2: Upload evidence for case #1
      mockEvidenceService.initiateUpload.mockResolvedValue({
        evidenceId: 'ev-1',
        uploadUrl: 'https://b2.example.com/upload',
        uploadFields: {},
      });
      mockParseRequestBody.mockResolvedValue({
        action: 'initiate',
        caseNumber: 1,
        filename: 'proof.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
      });

      const { route: evidenceRoute } = createEvidenceRoute();
      const uploadReq = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_A },
      });
      const uploadRes = createMockResponse();
      await evidenceRoute.run(uploadReq, uploadRes as any);

      expectStatus(uploadRes, 200);
      expect(mockEvidenceService.initiateUpload).toHaveBeenCalledWith(
        expect.objectContaining({ guildId: GUILD_A, caseNumber: 1 }),
      );

      // Step 3: List evidence for case #1
      const evidenceItems = [
        { id: 'ev-1', guildId: GUILD_A, caseNumber: 1, type: 'IMAGE', status: 'VERIFIED' },
      ];
      mockEvidenceService.getEvidenceForCase.mockResolvedValue(evidenceItems);
      mockEvidenceService.getEvidenceSummary.mockResolvedValue({
        total: 1,
        byType: { IMAGE: 1 },
        byStatus: { VERIFIED: 1 },
      });

      const evidenceListReq = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
        query: { caseNumber: '1' },
      });
      const evidenceListRes = createMockResponse();
      await evidenceRoute.run(evidenceListReq, evidenceListRes as any);

      expectStatus(evidenceListRes, 200);
      expect(mockEvidenceService.getEvidenceForCase).toHaveBeenCalledWith(GUILD_A, 1);
      expect((evidenceListRes.data as any).evidence).toHaveLength(1);
    });
  });

  // ─── 2. Case filter combinations 

  describe('Case filter combinations', () => {
    it('filters cases by action, status, and targetId together', async () => {
      const { route, prisma } = createCasesRoute();
      prisma.modCase.count.mockResolvedValue(1);
      prisma.modCase.findMany.mockResolvedValue([
        makeCase({ action: 'BAN', status: 'OPEN', targetId: 'target-1' }),
      ]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
        query: { action: 'BAN', status: 'OPEN', targetId: 'target-1' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(prisma.modCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            guildId: GUILD_A,
            action: 'BAN',
            status: 'OPEN',
            targetId: 'target-1',
          }),
        }),
      );
    });

    it('filters cases by moderatorId', async () => {
      const { route, prisma } = createCasesRoute();
      prisma.modCase.count.mockResolvedValue(1);
      prisma.modCase.findMany.mockResolvedValue([
        makeCase({ moderatorId: 'mod-1' }),
      ]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
        query: { moderatorId: 'mod-1' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(prisma.modCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ moderatorId: 'mod-1' }),
        }),
      );
    });

    it('searches cases by text across targetTag, targetId, moderatorTag', async () => {
      const { route, prisma } = createCasesRoute();
      prisma.modCase.count.mockResolvedValue(1);
      prisma.modCase.findMany.mockResolvedValue([
        makeCase({ targetTag: 'SuspiciousUser#9999' }),
      ]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
        query: { search: 'Suspicious' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(prisma.modCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ targetTag: { contains: 'Suspicious', mode: 'insensitive' } }),
            ]),
          }),
        }),
      );
    });
  });

  // ─── 3. Pagination boundary 

  describe('Pagination boundary', () => {
    it('page 1 and page 2 return correct slices', async () => {
      const { route, prisma } = createCasesRoute();

      // Page 1
      const allCases = Array.from({ length: 10 }, (_, i) =>
        makeCase({ id: `case-${i}`, caseNumber: i + 1 }),
      );
      prisma.modCase.count.mockResolvedValue(10);
      prisma.modCase.findMany.mockResolvedValue(allCases.slice(0, 5));

      const page1Req = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
        query: { page: '1', limit: '5' },
      });
      const page1Res = createMockResponse();
      await route.run(page1Req, page1Res as any);

      expectStatus(page1Res, 200);
      const page1Data = page1Res.data as any;
      expect(page1Data.total).toBe(10);
      expect(page1Data.page).toBe(1);
      expect(page1Data.totalPages).toBe(2);
      expect(page1Data.cases).toHaveLength(5);

      // Verify pagination args: skip=0, take=5
      expect(prisma.modCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 5 }),
      );

      // Page 2
      vi.clearAllMocks();
      prisma.modCase.count.mockResolvedValue(10);
      prisma.modCase.findMany.mockResolvedValue(allCases.slice(5));

      const page2Req = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
        query: { page: '2', limit: '5' },
      });
      const page2Res = createMockResponse();
      await route.run(page2Req, page2Res as any);

      expectStatus(page2Res, 200);
      expect(prisma.modCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });

    it('limit is capped at 100', async () => {
      const { route, prisma } = createCasesRoute();
      prisma.modCase.count.mockResolvedValue(0);
      prisma.modCase.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
        query: { limit: '500' },
      });
      const response = createMockResponse();
      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(prisma.modCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  // ─── 4. Case number uniqueness per guild 

  describe('Case number uniqueness per guild', () => {
    it('two guilds with caseNumber=1 return independent results', async () => {
      // Guild A
      const { route: routeA, prisma: prismaA } = createCasesRoute([GUILD_A]);
      const caseA = makeCase({ guildId: GUILD_A, caseNumber: 1, targetTag: 'UserA#0001' });
      prismaA.modCase.count.mockResolvedValue(1);
      prismaA.modCase.findMany.mockResolvedValue([caseA]);

      const reqA = createMockRequest({ method: 'GET', params: { guildId: GUILD_A } });
      const resA = createMockResponse();
      await routeA.run(reqA, resA as any);

      expectStatus(resA, 200);
      expect(prismaA.modCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ guildId: GUILD_A }),
        }),
      );

      // Guild B
      const { route: routeB, prisma: prismaB } = createCasesRoute([GUILD_B]);
      const caseB = makeCase({ guildId: GUILD_B, caseNumber: 1, targetTag: 'UserB#0002' });
      prismaB.modCase.count.mockResolvedValue(1);
      prismaB.modCase.findMany.mockResolvedValue([caseB]);

      const reqB = createMockRequest({ method: 'GET', params: { guildId: GUILD_B } });
      const resB = createMockResponse();
      await routeB.run(reqB, resB as any);

      expectStatus(resB, 200);
      expect(prismaB.modCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ guildId: GUILD_B }),
        }),
      );

      // Verify guild isolation
      const argsA = JSON.stringify(prismaA.modCase.findMany.mock.calls);
      expect(argsA).not.toContain(GUILD_B);

      const argsB = JSON.stringify(prismaB.modCase.findMany.mock.calls);
      expect(argsB).not.toContain(GUILD_A);
    });
  });

  // ─── 5. Evidence summary on case listing 

  describe('Evidence summary on case listing', () => {
    it('per-case evidence query returns evidence with summary', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      mockEvidenceService.getEvidenceForCase.mockResolvedValue([
        { id: 'ev-1', type: 'IMAGE', status: 'VERIFIED' },
        { id: 'ev-2', type: 'VIDEO', status: 'VERIFIED' },
      ]);
      mockEvidenceService.getEvidenceSummary.mockResolvedValue({
        total: 2,
        byType: { IMAGE: 1, VIDEO: 1 },
        byStatus: { VERIFIED: 2 },
        totalSizeBytes: 5120,
      });

      const { route } = createEvidenceRoute();
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
        query: { caseNumber: '1' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      const data = response.data as any;
      expect(data.evidence).toHaveLength(2);
      expect(data.summary.total).toBe(2);
      expect(data.summary.byType.IMAGE).toBe(1);
      expect(data.summary.byType.VIDEO).toBe(1);
    });
  });

  // ─── 6. Sort ordering ───

  describe('Sort ordering', () => {
    it('cases can be sorted by createdAt asc', async () => {
      const { route, prisma } = createCasesRoute();
      prisma.modCase.count.mockResolvedValue(2);
      prisma.modCase.findMany.mockResolvedValue([
        makeCase({ caseNumber: 1, createdAt: new Date('2025-01-01') }),
        makeCase({ caseNumber: 2, createdAt: new Date('2025-01-02') }),
      ]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
        query: { sort: 'createdAt', order: 'asc' },
      });
      const response = createMockResponse();
      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(prisma.modCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        }),
      );
    });

    it('cases default to createdAt desc', async () => {
      const { route, prisma } = createCasesRoute();
      prisma.modCase.count.mockResolvedValue(0);
      prisma.modCase.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
      });
      const response = createMockResponse();
      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(prisma.modCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('can sort by caseNumber desc', async () => {
      const { route, prisma } = createCasesRoute();
      prisma.modCase.count.mockResolvedValue(0);
      prisma.modCase.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
        query: { sort: 'caseNumber', order: 'desc' },
      });
      const response = createMockResponse();
      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(prisma.modCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { caseNumber: 'desc' },
        }),
      );
    });

    it('invalid sort field falls back to createdAt', async () => {
      const { route, prisma } = createCasesRoute();
      prisma.modCase.count.mockResolvedValue(0);
      prisma.modCase.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
        query: { sort: 'invalidField' },
      });
      const response = createMockResponse();
      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(prisma.modCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  // ─── 7. Guild not found ───

  describe('Guild not found', () => {
    it('returns 401 when ApiGate cannot resolve session for unknown guild', async () => {
      mockApiGateFromRequest.mockResolvedValue(null);

      const { route } = createCasesRoute(['other-guild']);
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: 'nonexistent-guild' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 401);
    });
  });

  // ─── 8. Missing guildId ───

  describe('Missing guildId', () => {
    it('returns 400 when guildId is not provided', async () => {
      const { route } = createCasesRoute();
      const request = createMockRequest({
        method: 'GET',
        params: {},
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
    });
  });

  // ─── 9. Invalid action filter ──

  describe('Invalid filter values', () => {
    it('invalid action filter is ignored (does not crash)', async () => {
      const { route, prisma } = createCasesRoute();
      prisma.modCase.count.mockResolvedValue(0);
      prisma.modCase.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
        query: { action: 'INVALID_ACTION' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      // Invalid action is parsed via parseModAction which returns undefined,
      // so it should not be in the where clause
      expect(prisma.modCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ action: 'INVALID_ACTION' }),
        }),
      );
    });

    it('invalid status filter is ignored', async () => {
      const { route, prisma } = createCasesRoute();
      prisma.modCase.count.mockResolvedValue(0);
      prisma.modCase.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_A },
        query: { status: 'NONEXISTENT_STATUS' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      // Invalid status is not in CaseStatus enum, so should not be in where
      expect(prisma.modCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ status: 'NONEXISTENT_STATUS' }),
        }),
      );
    });
  });

  // ─── 10. Evidence guild-wide listing with pagination 

  describe('Evidence guild-wide listing', () => {
    it('returns paginated evidence for a guild without caseNumber filter', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      mockEvidenceService.getEvidenceForGuild.mockResolvedValue({
        evidence: [
          { id: 'ev-1', type: 'IMAGE' },
          { id: 'ev-2', type: 'VIDEO' },
        ],
        total: 15,
        page: 1,
        totalPages: 2,
      });

      const { route } = createEvidenceRoute();
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
        expect.objectContaining({ page: 1, limit: 10 }),
      );
      expect((response.data as any).total).toBe(15);
    });
  });
});
