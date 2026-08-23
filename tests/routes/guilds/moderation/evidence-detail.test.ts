import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvidenceDetailRoute } from '#routes/guilds/moderation/evidence/[evidenceId].js';
import {
  createMockRequest,
  createMockResponse,
  createMockContainer,
  expectStatus,
} from '../../../helpers/test-helpers.js';

// Hoisted mocks
const {
  mockApiGateFromRequest,
  mockEvidenceService,
  mockAccessLogService,
  mockWatermarkService,
  mockParseRequestBody,
} = vi.hoisted(() => ({
  mockApiGateFromRequest: vi.fn(),
  mockEvidenceService: {
    getEvidenceById: vi.fn(),
    generateViewUrl: vi.fn(),
    generateDownloadUrl: vi.fn(),
    getEvidenceHistory: vi.fn(),
    amendEvidence: vi.fn(),
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
}));

vi.mock('#lib/validation/ApiGate.js', () => ({
  ApiGate: { fromRequest: mockApiGateFromRequest },
}));

vi.mock('#lib/validation/RateLimitGate.js', () => ({
  RateLimitGate: {
    LIMITS: {
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

vi.mock('#lib/route-utils.js', () => ({
  parseRequestBody: mockParseRequestBody,
}));

function createMockGate(overrides: Partial<{
  userId: string;
  authOk: boolean;
  rateLimitOk: boolean;
}> = {}) {
  return {
    userId: overrides.userId ?? 'user-123',
    member: { user: { tag: 'TestUser#1234' } },
    checkAuth: vi.fn().mockResolvedValue({
      ok: overrides.authOk ?? true,
      code: overrides.authOk === false ? 'NO_PERMISSION' : undefined,
    }),
    checkRateLimit: vi.fn().mockResolvedValue({
      ok: overrides.rateLimitOk ?? true,
    }),
    checkResourceAuth: vi.fn().mockResolvedValue({
      ok: true,
    }),
  };
}

const GUILD_ID = '123456789';
const EVIDENCE_ID = 'ev-abc-123';

describe('EvidenceDetailRoute', () => {
  let route: EvidenceDetailRoute;
  let mockContainer: ReturnType<typeof createMockContainer>;
  const mockModConfigFindUnique = vi.fn();

  beforeEach(() => {
    mockContainer = createMockContainer();
    (mockContainer as any).prisma = {
      modConfig: {
        findUnique: mockModConfigFindUnique,
      },
    };
    route = Object.create(EvidenceDetailRoute.prototype);
    Object.defineProperty(route, 'container', {
      get: () => mockContainer,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  // ─── Common / Auth ──

  describe('common checks', () => {
    it('returns 400 when guildId is missing', async () => {
      const request = createMockRequest({
        method: 'GET',
        params: { evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
      expect((response.data as any).error).toContain('Guild ID');
    });

    it('returns 400 when evidenceId is missing', async () => {
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
      expect((response.data as any).error).toContain('Evidence ID');
    });

    it('returns 401 when unauthenticated', async () => {
      mockApiGateFromRequest.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 401);
      expect((response.data as any).code).toBe('NOT_AUTHENTICATED');
    });

    it('returns 403 when unauthorized', async () => {
      const gate = createMockGate({ authOk: false });
      mockApiGateFromRequest.mockResolvedValue(gate);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 403);
      expect(gate.checkAuth).toHaveBeenCalledWith('mod.evidence.view');
    });

    it('returns 429 when rate limited', async () => {
      const gate = createMockGate({ rateLimitOk: false });
      mockApiGateFromRequest.mockResolvedValue(gate);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 429);
    });

    it('returns 405 for unsupported HTTP methods', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      const request = createMockRequest({
        method: 'DELETE',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 405);
    });

    it('returns 500 on unhandled error in POST path', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockParseRequestBody.mockRejectedValueOnce(new Error('Body parsing exploded'));

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 500);
      expect((response.data as any).error).toBe('Internal server error');
    });
  });

  // ─── GET default (detail) ───

  describe('GET default (detail)', () => {
    it('returns evidence detail', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID, type: 'IMAGE', filename: 'photo.png' };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(response.data).toEqual(evidence);
      expect(mockEvidenceService.getEvidenceById).toHaveBeenCalledWith(EVIDENCE_ID);
    });

    it('returns 404 when evidence not found', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockEvidenceService.getEvidenceById.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 404);
      expect((response.data as any).error).toBe('Evidence not found');
    });
  });

  // ─── GET view-url ───

  describe('GET view-url', () => {
    it('generates presigned view URL and logs VIEW access', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID, caseId: 'case-1' };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockEvidenceService.generateViewUrl.mockResolvedValue('https://cdn.example.com/view/ev-abc');

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'view-url' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect((response.data as any).url).toBe('https://cdn.example.com/view/ev-abc');
      expect(mockEvidenceService.generateViewUrl).toHaveBeenCalledWith(EVIDENCE_ID);
      expect(mockAccessLogService.logAccess).toHaveBeenCalledWith(
        EVIDENCE_ID,
        GUILD_ID,
        'user-123',
        'TestUser#1234',
        'VIEW',
        request
      );
    });

    it('returns 403 when resource auth fails (case-level)', async () => {
      const gate = createMockGate();
      gate.checkResourceAuth.mockResolvedValue({ ok: false, code: 'CASE_RESTRICTED' });
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID, caseId: 'case-1' };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'view-url' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 403);
      expect(gate.checkResourceAuth).toHaveBeenCalledWith('mod.evidence.view', {
        caseId: 'case-1',
      });
      expect(mockEvidenceService.generateViewUrl).not.toHaveBeenCalled();
    });

    it('returns 404 when evidence not found', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockEvidenceService.getEvidenceById.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'view-url' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 404);
      expect((response.data as any).error).toBe('Evidence not found');
    });
  });

  // ─── GET download-url ─

  describe('GET download-url', () => {
    it('generates presigned download URL and logs DOWNLOAD access', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID, caseId: 'case-1' };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockEvidenceService.generateDownloadUrl.mockResolvedValue('https://cdn.example.com/dl/ev-abc');

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'download-url' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect((response.data as any).url).toBe('https://cdn.example.com/dl/ev-abc');
      expect(mockEvidenceService.generateDownloadUrl).toHaveBeenCalledWith(EVIDENCE_ID);
      expect(mockAccessLogService.logAccess).toHaveBeenCalledWith(
        EVIDENCE_ID,
        GUILD_ID,
        'user-123',
        'TestUser#1234',
        'DOWNLOAD',
        request
      );
    });

    it('returns 404 when evidence not found', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockEvidenceService.getEvidenceById.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'download-url' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 404);
      expect((response.data as any).error).toBe('Evidence not found');
    });

    it('returns 403 when resource auth fails', async () => {
      const gate = createMockGate();
      gate.checkResourceAuth.mockResolvedValue({ ok: false, code: 'CASE_RESTRICTED' });
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID, caseId: 'case-1' };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'download-url' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 403);
      expect(mockEvidenceService.generateDownloadUrl).not.toHaveBeenCalled();
    });
  });

  // ─── GET watermarked-download 

  describe('GET watermarked-download', () => {
    it('returns watermarked URL when config enabled (default)', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID, caseId: 'case-1' };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      // No config found, defaults to watermark enabled
      mockModConfigFindUnique.mockResolvedValue(null);
      const watermarkResult = { url: 'https://cdn.example.com/wm/ev-abc', watermarked: true };
      mockWatermarkService.getWatermarkedUrl.mockResolvedValue(watermarkResult);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'watermarked-download' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(response.data).toEqual(watermarkResult);
      expect(mockWatermarkService.getWatermarkedUrl).toHaveBeenCalledWith(
        EVIDENCE_ID,
        GUILD_ID,
        'TestUser#1234' // falls back to user tag when no custom text
      );
      expect(mockAccessLogService.logAccess).toHaveBeenCalledWith(
        EVIDENCE_ID,
        GUILD_ID,
        'user-123',
        'TestUser#1234',
        'DOWNLOAD',
        request,
        { watermarked: true }
      );
    });

    it('falls back to regular download when watermark disabled', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID, caseId: 'case-1' };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockModConfigFindUnique.mockResolvedValue({ guildId: GUILD_ID, watermarkDownloads: false });
      mockEvidenceService.generateDownloadUrl.mockResolvedValue('https://cdn.example.com/dl/ev-abc');

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'watermarked-download' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect((response.data as any).url).toBe('https://cdn.example.com/dl/ev-abc');
      expect((response.data as any).watermarked).toBe(false);
      expect(mockWatermarkService.getWatermarkedUrl).not.toHaveBeenCalled();
      expect(mockEvidenceService.generateDownloadUrl).toHaveBeenCalledWith(EVIDENCE_ID);
      expect(mockAccessLogService.logAccess).toHaveBeenCalledWith(
        EVIDENCE_ID,
        GUILD_ID,
        'user-123',
        'TestUser#1234',
        'DOWNLOAD',
        request
      );
    });

    it('returns 403 when resource auth fails', async () => {
      const gate = createMockGate();
      gate.checkResourceAuth.mockResolvedValue({ ok: false, code: 'CASE_RESTRICTED' });
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID, caseId: 'case-1' };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'watermarked-download' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 403);
      expect(mockWatermarkService.getWatermarkedUrl).not.toHaveBeenCalled();
      expect(mockEvidenceService.generateDownloadUrl).not.toHaveBeenCalled();
    });

    it('uses custom watermark text from config', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID, caseId: 'case-1' };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockModConfigFindUnique.mockResolvedValue({
        guildId: GUILD_ID,
        watermarkDownloads: true,
        watermarkText: 'CONFIDENTIAL - MyServer',
      });
      mockWatermarkService.getWatermarkedUrl.mockResolvedValue({ url: 'https://cdn.example.com/wm/ev-abc', watermarked: true });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'watermarked-download' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(mockWatermarkService.getWatermarkedUrl).toHaveBeenCalledWith(
        EVIDENCE_ID,
        GUILD_ID,
        'CONFIDENTIAL - MyServer'
      );
    });
  });

  // ─── GET access-log ─

  describe('GET access-log', () => {
    it('returns paginated access log', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      const logResult = {
        entries: [{ id: 'log-1', action: 'VIEW', userId: 'user-123' }],
        total: 1,
        page: 1,
        totalPages: 1,
      };
      mockAccessLogService.getAccessLog.mockResolvedValue(logResult);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'access-log', page: '2', limit: '25' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(response.data).toEqual(logResult);
      expect(mockAccessLogService.getAccessLog).toHaveBeenCalledWith(EVIDENCE_ID, {
        page: 2,
        limit: 25,
      });
    });

    it('enforces guild isolation (evidence.guildId !== guildId returns 404)', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      // Evidence belongs to a different guild
      const evidence = { id: EVIDENCE_ID, guildId: 'other-guild-999' };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'access-log' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 404);
      expect((response.data as any).error).toBe('Evidence not found');
    });

    it('falls back to view permission when audit perm fails', async () => {
      const gate = createMockGate();
      // First call (mod.evidence.view) passes, second call (mod.evidence.audit) fails,
      // third call (mod.evidence.view fallback) passes
      gate.checkAuth
        .mockResolvedValueOnce({ ok: true })  // initial mod.evidence.view
        .mockResolvedValueOnce({ ok: false, code: 'NO_PERMISSION' }) // mod.evidence.audit
        .mockResolvedValueOnce({ ok: true });  // fallback mod.evidence.view
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockAccessLogService.getAccessLog.mockResolvedValue({ entries: [], total: 0 });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'access-log' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      // Should have called checkAuth 3 times: initial view, audit, fallback view
      expect(gate.checkAuth).toHaveBeenCalledTimes(3);
      expect(gate.checkAuth).toHaveBeenNthCalledWith(2, 'mod.evidence.audit');
      expect(gate.checkAuth).toHaveBeenNthCalledWith(3, 'mod.evidence.view');
    });

    it('returns 404 when evidence not found', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockEvidenceService.getEvidenceById.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'access-log' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 404);
    });
  });

  // ─── GET history 

  describe('GET history', () => {
    it('returns amendment history', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      const history = [
        { id: 'amend-1', action: 'NOTE_ADDED', newValue: 'A note', createdAt: '2025-01-01' },
        { id: 'amend-2', action: 'DESCRIPTION_UPDATED', newValue: 'New desc', createdAt: '2025-01-02' },
      ];
      mockEvidenceService.getEvidenceHistory.mockResolvedValue(history);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'history' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect((response.data as any).history).toEqual(history);
      expect(mockEvidenceService.getEvidenceById).toHaveBeenCalledWith(EVIDENCE_ID);
      expect(mockEvidenceService.getEvidenceHistory).toHaveBeenCalledWith(EVIDENCE_ID);
    });

    it('returns 404 when evidence not found', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockEvidenceService.getEvidenceById.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'history' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 404);
    });

    it('returns 404 when evidence belongs to different guild', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockEvidenceService.getEvidenceById.mockResolvedValue({ id: EVIDENCE_ID, guildId: 'other-guild' });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'history' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 404);
      expect((response.data as any).error).toBe('Evidence not found');
    });
  });

  // ─── POST amend (default) ──

  describe('POST amend (default)', () => {
    it('creates amendment with action/newValue/reason', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockParseRequestBody.mockResolvedValue({
        action: 'NOTE_ADDED',
        newValue: 'Important context',
        reason: 'Adding note for context',
      });
      const amendment = { id: 'amend-1', action: 'NOTE_ADDED', newValue: 'Important context' };
      mockEvidenceService.amendEvidence.mockResolvedValue(amendment);

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(response.data).toEqual(amendment);
      expect(mockEvidenceService.getEvidenceById).toHaveBeenCalledWith(EVIDENCE_ID);
      expect(mockEvidenceService.amendEvidence).toHaveBeenCalledWith({
        evidenceId: EVIDENCE_ID,
        amendedById: 'user-123',
        amendedByTag: 'TestUser#1234',
        action: 'NOTE_ADDED',
        newValue: 'Important context',
        reason: 'Adding note for context',
      });
    });

    it('requires mod.evidence.add permission', async () => {
      const gate = createMockGate();
      // Initial view check passes, but add check fails
      gate.checkAuth
        .mockResolvedValueOnce({ ok: true }) // mod.evidence.view
        .mockResolvedValueOnce({ ok: false, code: 'NO_PERMISSION' }); // mod.evidence.add
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockParseRequestBody.mockResolvedValue({ action: 'NOTE_ADDED' });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 403);
      expect(gate.checkAuth).toHaveBeenCalledWith('mod.evidence.add');
    });

    it('rejects missing action field in body', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockParseRequestBody.mockResolvedValue({ newValue: 'something' }); // no action

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
      expect((response.data as any).error).toContain('action is required');
    });
  });

  // ─── POST add-timestamp ────

  describe('POST add-timestamp', () => {
    it('adds timestamp with time and note', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockParseRequestBody.mockResolvedValue({
        action: 'add-timestamp',
        time: 42.5,
        note: 'Suspect visible at this point',
      });
      const result = { id: EVIDENCE_ID, timestamps: [{ time: 42.5, note: 'Suspect visible at this point' }] };
      mockEvidenceService.addTimestamp.mockResolvedValue(result);

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(response.data).toEqual(result);
      expect(mockEvidenceService.getEvidenceById).toHaveBeenCalledWith(EVIDENCE_ID);
      expect(mockEvidenceService.addTimestamp).toHaveBeenCalledWith(EVIDENCE_ID, {
        time: 42.5,
        note: 'Suspect visible at this point',
        addedById: 'user-123',
        addedByTag: 'TestUser#1234',
      });
    });

    it('rejects negative time', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockParseRequestBody.mockResolvedValue({
        action: 'add-timestamp',
        time: -5,
        note: 'Invalid timestamp',
      });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
      expect((response.data as any).error).toContain('time is required');
    });

    it('rejects missing note', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockParseRequestBody.mockResolvedValue({
        action: 'add-timestamp',
        time: 10,
      });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
      expect((response.data as any).error).toContain('note is required');
    });

    it('rejects non-numeric time', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockParseRequestBody.mockResolvedValue({
        action: 'add-timestamp',
        time: 'not-a-number',
        note: 'A note',
      });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
      expect((response.data as any).error).toContain('time is required');
    });
  });

  // ─── POST remove-timestamp ─

  describe('POST remove-timestamp', () => {
    it('removes timestamp by ID', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockParseRequestBody.mockResolvedValue({
        action: 'remove-timestamp',
        timestampId: 'ts-999',
      });
      const result = { id: EVIDENCE_ID, timestamps: [] };
      mockEvidenceService.removeTimestamp.mockResolvedValue(result);

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(response.data).toEqual(result);
      expect(mockEvidenceService.getEvidenceById).toHaveBeenCalledWith(EVIDENCE_ID);
      expect(mockEvidenceService.removeTimestamp).toHaveBeenCalledWith(
        EVIDENCE_ID,
        'ts-999',
        'user-123',
        'TestUser#1234'
      );
    });

    it('rejects missing timestampId', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const evidence = { id: EVIDENCE_ID, guildId: GUILD_ID };
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockParseRequestBody.mockResolvedValue({
        action: 'remove-timestamp',
      });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
      expect((response.data as any).error).toContain('timestampId is required');
    });
  });
});
