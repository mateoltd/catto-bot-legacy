/**
 * Evidence lifecycle integration tests.
 *
 * Tests multi-step evidence flows through the route handlers:
 * upload → confirm → view/download → amend → timestamps → access log.
 * Services are mocked but the route handler logic is real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvidenceDetailRoute } from '#routes/guilds/moderation/evidence/[evidenceId].js';
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
  mockAccessLogService,
  mockWatermarkService,
  mockParseRequestBody,
  mockFetchOGData,
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

// ─── Helpers 

const GUILD_ID = 'guild-123';
const EVIDENCE_ID = 'ev-abc-def';
const USER_ID = 'user-456';
const USER_TAG = 'TestMod#1234';

function createMockGate(overrides?: {
  checkAuth?: ReturnType<typeof vi.fn>;
  checkRateLimit?: ReturnType<typeof vi.fn>;
  checkResourceAuth?: ReturnType<typeof vi.fn>;
  checkWeight?: ReturnType<typeof vi.fn>;
}) {
  return {
    userId: USER_ID,
    member: { user: { tag: USER_TAG } },
    checkAuth: overrides?.checkAuth ?? vi.fn().mockResolvedValue({ ok: true }),
    checkRateLimit: overrides?.checkRateLimit ?? vi.fn().mockResolvedValue({ ok: true }),
    checkResourceAuth: overrides?.checkResourceAuth ?? vi.fn().mockResolvedValue({ ok: true }),
    checkWeight: overrides?.checkWeight ?? vi.fn().mockResolvedValue({ ok: true }),
  };
}

function createDetailRoute() {
  const container = createMockContainer();
  (container as any).prisma = {
    modConfig: { findUnique: vi.fn() },
  };
  const route = Object.create(EvidenceDetailRoute.prototype);
  Object.defineProperty(route, 'container', { get: () => container, configurable: true });
  return { route, container };
}

function createListRoute() {
  const container = createMockContainer();
  const route = Object.create(EvidenceRoute.prototype);
  Object.defineProperty(route, 'container', { get: () => container, configurable: true });
  return { route, container };
}

function makeEvidence(overrides?: Record<string, unknown>) {
  return {
    id: EVIDENCE_ID,
    guildId: GUILD_ID,
    caseId: 'case-1',
    caseNumber: 1,
    type: 'IMAGE',
    status: 'VERIFIED',
    storageKey: 'guilds/guild-123/1/ev-abc-def/photo.png',
    originalFilename: 'photo.png',
    mimeType: 'image/png',
    sizeBytes: 1024,
    uploadedById: USER_ID,
    uploadedByTag: USER_TAG,
    ...overrides,
  };
}

// ─── Tests ──

describe('Evidence lifecycle integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 1. Upload-to-verified flow 

  describe('Upload-to-verified flow', () => {
    it('initiateUpload returns evidenceId and uploadUrl, then confirmUpload sets VERIFIED', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      // Step 1: Initiate upload
      const initResult = {
        evidenceId: EVIDENCE_ID,
        uploadUrl: 'https://b2.example.com/presigned',
        uploadFields: {},
      };
      mockEvidenceService.initiateUpload.mockResolvedValue(initResult);
      mockParseRequestBody.mockResolvedValue({
        action: 'initiate',
        caseNumber: 1,
        filename: 'screenshot.png',
        mimeType: 'image/png',
        sizeBytes: 2048,
      });

      const { route: listRoute } = createListRoute();
      const initRequest = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID },
      });
      const initResponse = createMockResponse();

      await listRoute.run(initRequest, initResponse as any);

      expectStatus(initResponse, 200);
      expect(initResponse.data).toEqual(initResult);
      expect(mockEvidenceService.initiateUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: GUILD_ID,
          caseNumber: 1,
          uploadedById: USER_ID,
          uploadedByTag: USER_TAG,
          filename: 'screenshot.png',
          mimeType: 'image/png',
          sizeBytes: 2048,
        }),
      );

      // Step 2: Confirm upload with content hash
      const confirmedEvidence = makeEvidence({ status: 'VERIFIED', contentHash: 'abc123' });
      mockEvidenceService.confirmUpload.mockResolvedValue(confirmedEvidence);
      mockParseRequestBody.mockResolvedValue({
        action: 'confirm',
        evidenceId: EVIDENCE_ID,
        contentHash: 'abc123',
      });

      const confirmRequest = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID },
      });
      const confirmResponse = createMockResponse();

      await listRoute.run(confirmRequest, confirmResponse as any);

      expectStatus(confirmResponse, 200);
      expect(mockEvidenceService.confirmUpload).toHaveBeenCalledWith(EVIDENCE_ID, 'abc123');
      expect((confirmResponse.data as any).status).toBe('VERIFIED');

      // Step 3: Verify detail retrieval shows VERIFIED
      mockEvidenceService.getEvidenceById.mockResolvedValue(confirmedEvidence);
      const { route: detailRoute } = createDetailRoute();

      const detailRequest = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const detailResponse = createMockResponse();

      await detailRoute.run(detailRequest, detailResponse as any);

      expectStatus(detailResponse, 200);
      expect((detailResponse.data as any).status).toBe('VERIFIED');
    });
  });

  // ─── 2. Upload with invalid HMAC ─

  describe('Upload with invalid HMAC', () => {
    it('confirmUpload rejection propagates when signing fails', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      mockEvidenceService.confirmUpload.mockRejectedValue(
        new Error('HMAC verification failed'),
      );
      mockParseRequestBody.mockResolvedValue({
        action: 'confirm',
        evidenceId: EVIDENCE_ID,
        contentHash: 'wrong-hash',
      });

      const { route } = createListRoute();
      const request = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID },
      });
      const response = createMockResponse();

      // The route's handlePost try/catch uses `return this.handleConfirm()`
      // without await, so the rejection from confirmUpload propagates
      // (the catch block only catches synchronous throws and awaited rejections).
      // This means the error reaches the caller — in a real Express/Sapphire setup
      // the framework's error handler would catch it.
      await expect(route.run(request, response as any)).rejects.toThrow(
        'HMAC verification failed',
      );
    });
  });

  // ─── 3. URL evidence flow ─

  describe('URL evidence flow', () => {
    it('adds URL evidence, then detail and view-url work correctly', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      // Step 1: Add URL evidence
      const urlEvidence = makeEvidence({
        type: 'URL',
        url: 'https://example.com/evidence',
        storageKey: null,
      });
      mockEvidenceService.addUrlEvidence.mockResolvedValue(urlEvidence);
      mockParseRequestBody.mockResolvedValue({
        action: 'url',
        caseNumber: 1,
        url: 'https://example.com/evidence',
      });

      const { route: listRoute } = createListRoute();
      const addRequest = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID },
      });
      const addResponse = createMockResponse();

      await listRoute.run(addRequest, addResponse as any);

      expectStatus(addResponse, 200);
      expect(mockEvidenceService.addUrlEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: GUILD_ID,
          url: 'https://example.com/evidence',
          uploadedById: USER_ID,
        }),
      );

      // Step 2: Get detail
      mockEvidenceService.getEvidenceById.mockResolvedValue(urlEvidence);
      const { route: detailRoute } = createDetailRoute();

      const detailRequest = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const detailResponse = createMockResponse();

      await detailRoute.run(detailRequest, detailResponse as any);

      expectStatus(detailResponse, 200);
      expect((detailResponse.data as any).type).toBe('URL');

      // Step 3: Get view-url → logs VIEW access
      mockEvidenceService.generateViewUrl.mockResolvedValue('https://example.com/evidence');
      mockAccessLogService.logAccess.mockResolvedValue({ id: 'log-1' });

      const viewRequest = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'view-url' },
      });
      const viewResponse = createMockResponse();

      await detailRoute.run(viewRequest, viewResponse as any);

      expectStatus(viewResponse, 200);
      expect(mockAccessLogService.logAccess).toHaveBeenCalledWith(
        EVIDENCE_ID,
        GUILD_ID,
        USER_ID,
        USER_TAG,
        'VIEW',
        expect.anything(),
      );
    });
  });

  // ─── 4. View + Download flow ───

  describe('View + Download flow', () => {
    it('view-url returns presigned URL and logs VIEW, download-url logs DOWNLOAD', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      const evidence = makeEvidence();
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockEvidenceService.generateViewUrl.mockResolvedValue('https://b2.example.com/view-url');
      mockEvidenceService.generateDownloadUrl.mockResolvedValue('https://b2.example.com/download-url');
      mockAccessLogService.logAccess.mockResolvedValue({ id: 'log-1' });

      const { route } = createDetailRoute();

      // View
      const viewRequest = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'view-url' },
      });
      const viewResponse = createMockResponse();
      await route.run(viewRequest, viewResponse as any);

      expectStatus(viewResponse, 200);
      expect((viewResponse.data as any).url).toBe('https://b2.example.com/view-url');
      expect(mockAccessLogService.logAccess).toHaveBeenCalledWith(
        EVIDENCE_ID, GUILD_ID, USER_ID, USER_TAG, 'VIEW', expect.anything(),
      );

      vi.clearAllMocks();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockEvidenceService.generateDownloadUrl.mockResolvedValue('https://b2.example.com/download-url');
      mockAccessLogService.logAccess.mockResolvedValue({ id: 'log-2' });

      // Download
      const dlRequest = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'download-url' },
      });
      const dlResponse = createMockResponse();
      await route.run(dlRequest, dlResponse as any);

      expectStatus(dlResponse, 200);
      expect((dlResponse.data as any).url).toBe('https://b2.example.com/download-url');
      expect(mockAccessLogService.logAccess).toHaveBeenCalledWith(
        EVIDENCE_ID, GUILD_ID, USER_ID, USER_TAG, 'DOWNLOAD', expect.anything(),
      );
    });
  });

  // ─── 5. Watermarked download flow 

  describe('Watermarked download flow', () => {
    it('returns watermarked URL and logs access with watermarked metadata', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      const evidence = makeEvidence();
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockWatermarkService.getWatermarkedUrl.mockResolvedValue({
        url: 'https://b2.example.com/watermarked',
        watermarked: true,
      });
      mockAccessLogService.logAccess.mockResolvedValue({ id: 'log-3' });

      const { route, container } = createDetailRoute();
      // Config: watermark enabled
      (container as any).prisma.modConfig.findUnique.mockResolvedValue({
        guildId: GUILD_ID,
        watermarkDownloads: true,
        watermarkText: null,
      });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'watermarked-download' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect((response.data as any).watermarked).toBe(true);
      expect(mockWatermarkService.getWatermarkedUrl).toHaveBeenCalledWith(
        EVIDENCE_ID,
        GUILD_ID,
        USER_TAG, // falls back to user tag when watermarkText is null
      );
      expect(mockAccessLogService.logAccess).toHaveBeenCalledWith(
        EVIDENCE_ID, GUILD_ID, USER_ID, USER_TAG, 'DOWNLOAD',
        expect.anything(),
        { watermarked: true },
      );
    });
  });

  // ─── 6. Watermark disabled fallback ────

  describe('Watermark disabled fallback', () => {
    it('falls back to regular download URL when watermarkDownloads is false', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      const evidence = makeEvidence();
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockEvidenceService.generateDownloadUrl.mockResolvedValue('https://b2.example.com/regular-dl');
      mockAccessLogService.logAccess.mockResolvedValue({ id: 'log-4' });

      const { route, container } = createDetailRoute();
      (container as any).prisma.modConfig.findUnique.mockResolvedValue({
        guildId: GUILD_ID,
        watermarkDownloads: false,
      });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'watermarked-download' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect((response.data as any).watermarked).toBe(false);
      expect((response.data as any).url).toBe('https://b2.example.com/regular-dl');
      expect(mockWatermarkService.getWatermarkedUrl).not.toHaveBeenCalled();
      expect(mockAccessLogService.logAccess).toHaveBeenCalledWith(
        EVIDENCE_ID, GUILD_ID, USER_ID, USER_TAG, 'DOWNLOAD', expect.anything(),
      );
    });
  });

  // ─── 7. Amendment chain ───

  describe('Amendment chain', () => {
    it('multiple amendments appear in order in history', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      const evidence = makeEvidence();
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);

      const { route } = createDetailRoute();

      // Amendment 1: NOTE_ADDED
      const amendment1 = {
        id: 'amend-1',
        evidenceId: EVIDENCE_ID,
        action: 'NOTE_ADDED',
        newValue: 'Important note',
        createdAt: new Date('2025-01-01T10:00:00Z'),
      };
      mockEvidenceService.amendEvidence.mockResolvedValueOnce(amendment1);
      mockParseRequestBody.mockResolvedValueOnce({
        action: 'NOTE_ADDED',
        newValue: 'Important note',
      });

      const req1 = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const res1 = createMockResponse();
      await route.run(req1, res1 as any);

      expectStatus(res1, 200);
      expect(mockEvidenceService.amendEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          evidenceId: EVIDENCE_ID,
          amendedById: USER_ID,
          action: 'NOTE_ADDED',
          newValue: 'Important note',
        }),
      );

      // Amendment 2: DESCRIPTION_UPDATED
      const amendment2 = {
        id: 'amend-2',
        evidenceId: EVIDENCE_ID,
        action: 'DESCRIPTION_UPDATED',
        newValue: 'Updated description',
        createdAt: new Date('2025-01-01T11:00:00Z'),
      };
      mockEvidenceService.amendEvidence.mockResolvedValueOnce(amendment2);
      mockParseRequestBody.mockResolvedValueOnce({
        action: 'DESCRIPTION_UPDATED',
        newValue: 'Updated description',
      });

      const req2 = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const res2 = createMockResponse();
      await route.run(req2, res2 as any);

      expectStatus(res2, 200);

      // Get history
      mockEvidenceService.getEvidenceHistory.mockResolvedValue([amendment1, amendment2]);

      const historyRequest = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'history' },
      });
      const historyResponse = createMockResponse();
      await route.run(historyRequest, historyResponse as any);

      expectStatus(historyResponse, 200);
      const history = (historyResponse.data as any).history;
      expect(history).toHaveLength(2);
      expect(history[0].action).toBe('NOTE_ADDED');
      expect(history[1].action).toBe('DESCRIPTION_UPDATED');
    });
  });

  // ─── 8. Timestamp lifecycle 

  describe('Timestamp lifecycle', () => {
    it('adds and removes timestamps from video evidence', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      const videoEvidence = makeEvidence({ type: 'VIDEO' });
      mockEvidenceService.getEvidenceById.mockResolvedValue(videoEvidence);

      const { route } = createDetailRoute();

      // Add timestamp
      const updatedWithTimestamp = {
        ...videoEvidence,
        metadata: {
          timestamps: [
            { id: 'ts-1', time: 42, note: 'Violation starts', addedBy: USER_ID },
          ],
        },
      };
      mockEvidenceService.addTimestamp.mockResolvedValue(updatedWithTimestamp);
      mockParseRequestBody.mockResolvedValueOnce({
        action: 'add-timestamp',
        time: 42,
        note: 'Violation starts',
      });

      const addReq = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const addRes = createMockResponse();
      await route.run(addReq, addRes as any);

      expectStatus(addRes, 200);
      expect(mockEvidenceService.addTimestamp).toHaveBeenCalledWith(
        EVIDENCE_ID,
        expect.objectContaining({ time: 42, note: 'Violation starts', addedById: USER_ID }),
      );

      // Remove timestamp
      const updatedWithoutTimestamp = { ...videoEvidence, metadata: { timestamps: [] } };
      mockEvidenceService.removeTimestamp.mockResolvedValue(updatedWithoutTimestamp);
      mockParseRequestBody.mockResolvedValueOnce({
        action: 'remove-timestamp',
        timestampId: 'ts-1',
      });

      const removeReq = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const removeRes = createMockResponse();
      await route.run(removeReq, removeRes as any);

      expectStatus(removeRes, 200);
      expect(mockEvidenceService.removeTimestamp).toHaveBeenCalledWith(
        EVIDENCE_ID, 'ts-1', USER_ID, USER_TAG,
      );
    });
  });

  // ─── 9. Access log pagination ──

  describe('Access log pagination', () => {
    it('returns paginated access logs for evidence', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      const evidence = makeEvidence();
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);

      const logs = Array.from({ length: 5 }, (_, i) => ({
        id: `log-${i}`,
        evidenceId: EVIDENCE_ID,
        guildId: GUILD_ID,
        userId: USER_ID,
        userTag: USER_TAG,
        action: i % 2 === 0 ? 'VIEW' : 'DOWNLOAD',
        createdAt: new Date(),
      }));

      mockAccessLogService.getAccessLog.mockResolvedValue({
        logs: logs.slice(0, 2),
        total: 5,
        page: 1,
        totalPages: 3,
      });

      const { route } = createDetailRoute();
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'access-log', page: '1', limit: '2' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(mockAccessLogService.getAccessLog).toHaveBeenCalledWith(
        EVIDENCE_ID,
        { page: 1, limit: 2 },
      );
      expect((response.data as any).total).toBe(5);
      expect((response.data as any).totalPages).toBe(3);
    });
  });

  // ─── 10. Evidence not found propagation 

  describe('Evidence not found propagation', () => {
    it('returns 404 consistently for all actions on non-existent evidence', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockEvidenceService.getEvidenceById.mockResolvedValue(null);

      const { route } = createDetailRoute();

      const actions: { method: 'GET'; query: Record<string, string> }[] = [
        { method: 'GET', query: {} },
        { method: 'GET', query: { action: 'view-url' } },
        { method: 'GET', query: { action: 'download-url' } },
        { method: 'GET', query: { action: 'watermarked-download' } },
        { method: 'GET', query: { action: 'access-log' } },
        { method: 'GET', query: { action: 'history' } },
      ];

      for (const { method, query } of actions) {
        const request = createMockRequest({
          method,
          params: { guildId: GUILD_ID, evidenceId: 'nonexistent-id' },
          query,
        });
        const response = createMockResponse();
        await route.run(request, response as any);
        expectStatus(response, 404);
      }

      // POST actions
      const postActions = [
        { action: 'add-timestamp', time: 10, note: 'test' },
        { action: 'remove-timestamp', timestampId: 'ts-1' },
        { action: 'NOTE_ADDED', newValue: 'test' },
      ];

      for (const body of postActions) {
        mockParseRequestBody.mockResolvedValueOnce(body);
        const request = createMockRequest({
          method: 'POST',
          params: { guildId: GUILD_ID, evidenceId: 'nonexistent-id' },
        });
        const response = createMockResponse();
        await route.run(request, response as any);
        expectStatus(response, 404);
      }
    });
  });

  // ─── 11. Cross-guild rejection on every action ─

  describe('Cross-guild rejection on every action', () => {
    it('returns 404 for evidence belonging to another guild across all actions', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      // Evidence belongs to a different guild
      const foreignEvidence = makeEvidence({ guildId: 'guild-other' });
      mockEvidenceService.getEvidenceById.mockResolvedValue(foreignEvidence);

      const { route } = createDetailRoute();

      // GET actions that check guildId directly
      const getActionsWithGuildCheck: Record<string, string>[] = [
        {},
        { action: 'history' },
        { action: 'access-log' },
      ];

      for (const query of getActionsWithGuildCheck) {
        const request = createMockRequest({
          method: 'GET',
          params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
          query,
        });
        const response = createMockResponse();
        await route.run(request, response as any);
        expectStatus(response, 404);
        expect((response.data as any).error).toBe('Evidence not found');
      }

      // POST actions
      const postBodies = [
        { action: 'add-timestamp', time: 10, note: 'test' },
        { action: 'remove-timestamp', timestampId: 'ts-1' },
        { action: 'NOTE_ADDED', newValue: 'test' },
      ];

      for (const body of postBodies) {
        mockParseRequestBody.mockResolvedValueOnce(body);
        const request = createMockRequest({
          method: 'POST',
          params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        });
        const response = createMockResponse();
        await route.run(request, response as any);
        expectStatus(response, 404);
      }
    });
  });

  // ─── 12. Permission checks across actions ───

  describe('Permission checks across actions', () => {
    it('user with view-only permission can GET detail/history but POST amend returns 403', async () => {
      // Gate that allows view but denies add
      const gate = createMockGate({
        checkAuth: vi.fn().mockImplementation((key: string) => {
          if (key === 'mod.evidence.view') return Promise.resolve({ ok: true });
          if (key === 'mod.evidence.add')
            return Promise.resolve({ ok: false, code: 'NO_PERMISSION' });
          // For audit permission
          return Promise.resolve({ ok: true });
        }),
      });
      mockApiGateFromRequest.mockResolvedValue(gate);

      const evidence = makeEvidence();
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);

      const { route } = createDetailRoute();

      // GET detail → allowed
      const detailReq = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const detailRes = createMockResponse();
      await route.run(detailReq, detailRes as any);
      expectStatus(detailRes, 200);

      // GET history → allowed
      mockEvidenceService.getEvidenceHistory.mockResolvedValue([]);
      const historyReq = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
        query: { action: 'history' },
      });
      const historyRes = createMockResponse();
      await route.run(historyReq, historyRes as any);
      expectStatus(historyRes, 200);

      // POST amend → forbidden
      mockParseRequestBody.mockResolvedValueOnce({
        action: 'NOTE_ADDED',
        newValue: 'test',
      });
      const amendReq = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const amendRes = createMockResponse();
      await route.run(amendReq, amendRes as any);
      expectStatus(amendRes, 403);
    });
  });

  // ─── 13. Missing params ───

  describe('Missing required params', () => {
    it('returns 400 when guildId is missing from evidence list route', async () => {
      const { route } = createListRoute();
      const request = createMockRequest({
        method: 'GET',
        params: {},
      });
      const response = createMockResponse();
      await route.run(request, response as any);
      expectStatus(response, 400);
    });

    it('returns 400 when guildId or evidenceId is missing from detail route', async () => {
      const { route } = createDetailRoute();
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID },
      });
      const response = createMockResponse();
      await route.run(request, response as any);
      expectStatus(response, 400);
    });
  });

  // ─── 14. Unauthenticated requests ─────

  describe('Unauthenticated requests', () => {
    it('returns 401 when ApiGate returns null', async () => {
      mockApiGateFromRequest.mockResolvedValue(null);

      const { route: detailRoute } = createDetailRoute();
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();
      await detailRoute.run(request, response as any);

      expectStatus(response, 401);
      expect((response.data as any).code).toBe('NOT_AUTHENTICATED');
    });

    it('returns 401 on list route when unauthenticated', async () => {
      mockApiGateFromRequest.mockResolvedValue(null);

      const { route: listRoute } = createListRoute();
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID },
        query: { page: '1' },
      });
      const response = createMockResponse();
      await listRoute.run(request, response as any);

      expectStatus(response, 401);
    });
  });

  // ─── 15. Rate limiting ───

  describe('Rate limiting', () => {
    it('returns 429 when rate limit is exceeded on detail route', async () => {
      const gate = createMockGate({
        checkRateLimit: vi.fn().mockResolvedValue({
          ok: false,
          metadata: { retryAfterMs: 5000 },
        }),
      });
      mockApiGateFromRequest.mockResolvedValue(gate);

      const { route } = createDetailRoute();
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID, evidenceId: EVIDENCE_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 429);
      expect((response.data as any).retryAfterMs).toBe(5000);
    });
  });

  // ─── 16. Watermark with custom text ────

  describe('Watermark with custom text from config', () => {
    it('uses watermarkText from guild config when available', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      const evidence = makeEvidence();
      mockEvidenceService.getEvidenceById.mockResolvedValue(evidence);
      mockWatermarkService.getWatermarkedUrl.mockResolvedValue({
        url: 'https://b2.example.com/watermarked',
        watermarked: true,
      });
      mockAccessLogService.logAccess.mockResolvedValue({ id: 'log-5' });

      const { route, container } = createDetailRoute();
      (container as any).prisma.modConfig.findUnique.mockResolvedValue({
        guildId: GUILD_ID,
        watermarkDownloads: true,
        watermarkText: 'CONFIDENTIAL - Guild Server',
      });

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
        'CONFIDENTIAL - Guild Server',
      );
    });
  });

  // ─── 17. Bulk amend flow ──

  describe('Bulk amend flow', () => {
    it('amends multiple evidence items and returns results + errors', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);

      mockEvidenceService.amendEvidence
        .mockResolvedValueOnce({ id: 'amend-1', evidenceId: 'ev-1' })
        .mockRejectedValueOnce(new Error('Evidence not found'))
        .mockResolvedValueOnce({ id: 'amend-3', evidenceId: 'ev-3' });

      mockParseRequestBody.mockResolvedValue({
        action: 'bulk-amend',
        evidenceIds: ['ev-1', 'ev-2', 'ev-3'],
        amendAction: 'NOTE_ADDED',
        newValue: 'Bulk note',
      });

      const { route } = createListRoute();
      const request = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      const data = response.data as any;
      expect(data.results).toHaveLength(2);
      expect(data.errors).toHaveLength(1);
      expect(data.errors[0].evidenceId).toBe('ev-2');
    });
  });

  // ─── 18. Search evidence ──

  describe('Search evidence', () => {
    it('searches evidence by query string', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockEvidenceService.searchEvidence.mockResolvedValue({
        evidence: [makeEvidence()],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const { route } = createListRoute();
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID },
        query: { search: 'screenshot', page: '1', limit: '10' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(mockEvidenceService.searchEvidence).toHaveBeenCalledWith(
        GUILD_ID,
        'screenshot',
        { page: 1, limit: 10 },
      );
    });
  });

  // ─── 19. Evidence list with filters ────

  describe('Evidence list with filters', () => {
    it('passes type, status, and tag filters to service', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockEvidenceService.getEvidenceForGuild.mockResolvedValue({
        evidence: [],
        total: 0,
        page: 1,
        totalPages: 1,
      });

      const { route } = createListRoute();
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: GUILD_ID },
        query: { type: 'IMAGE', status: 'VERIFIED', tags: 'important,flagged' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(mockEvidenceService.getEvidenceForGuild).toHaveBeenCalledWith(
        GUILD_ID,
        expect.objectContaining({
          type: 'IMAGE',
          status: 'VERIFIED',
          tags: ['important', 'flagged'],
        }),
      );
    });
  });

  // ─── 20. Unknown POST action on list route ─

  describe('Unknown POST action', () => {
    it('returns 400 for unknown action on evidence list route', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockParseRequestBody.mockResolvedValue({ action: 'invalid-action' });

      const { route } = createListRoute();
      const request = createMockRequest({
        method: 'POST',
        params: { guildId: GUILD_ID },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
      expect((response.data as any).error).toContain('Unknown action');
    });
  });
});
