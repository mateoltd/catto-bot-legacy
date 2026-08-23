import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvidenceRoute } from '#routes/guilds/moderation/evidence/index.js';
import {
  createMockRequest,
  createMockResponse,
  createMockContainer,
  expectStatus,
} from '../../../helpers/test-helpers.js';

// Hoisted mocks
const { mockApiGateFromRequest, mockEvidenceService, mockParseRequestBody, mockFetchOGData } =
  vi.hoisted(() => ({
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
    },
    mockParseRequestBody: vi.fn(),
    mockFetchOGData: vi.fn(),
  }));

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

function createMockGate(overrides: Partial<{
  userId: string;
  authOk: boolean;
  rateLimitOk: boolean;
  weightOk: boolean;
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
    checkWeight: vi.fn().mockResolvedValue({
      ok: overrides.weightOk ?? true,
    }),
  };
}

describe('EvidenceRoute', () => {
  let route: EvidenceRoute;
  let mockContainer: ReturnType<typeof createMockContainer>;

  beforeEach(() => {
    mockContainer = createMockContainer();
    route = Object.create(EvidenceRoute.prototype);
    Object.defineProperty(route, 'container', {
      get: () => mockContainer,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  describe('GET /evidence', () => {
    it('returns paginated guild-wide evidence', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const result = { evidence: [{ id: 'ev-1' }], total: 1, page: 1, totalPages: 1 };
      mockEvidenceService.getEvidenceForGuild.mockResolvedValue(result);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { page: '1', limit: '10' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(mockEvidenceService.getEvidenceForGuild).toHaveBeenCalledWith('123456789', {
        page: 1,
        limit: 10,
        type: undefined,
        status: undefined,
        caseNumber: undefined,
        tags: undefined,
      });
    });

    it('filters by type, status, and tags', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockEvidenceService.getEvidenceForGuild.mockResolvedValue({ evidence: [], total: 0 });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { type: 'IMAGE', status: 'VERIFIED', tags: 'important,review' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockEvidenceService.getEvidenceForGuild).toHaveBeenCalledWith('123456789', expect.objectContaining({
        type: 'IMAGE',
        status: 'VERIFIED',
        tags: ['important', 'review'],
      }));
    });

    it('returns evidence for specific case when caseNumber provided', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockEvidenceService.getEvidenceForCase.mockResolvedValue([{ id: 'ev-1' }]);
      mockEvidenceService.getEvidenceSummary.mockResolvedValue({ total: 1 });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { caseNumber: '42' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockEvidenceService.getEvidenceForCase).toHaveBeenCalledWith('123456789', 42);
    });

    it('searches evidence with search query (2+ chars)', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockEvidenceService.searchEvidence.mockResolvedValue({ evidence: [], total: 0 });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { search: 'screenshot' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockEvidenceService.searchEvidence).toHaveBeenCalledWith('123456789', 'screenshot', { page: 1, limit: 50 });
    });

    it('falls through to guild-wide evidence when search is under 2 chars', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockEvidenceService.getEvidenceForGuild.mockResolvedValue({ evidence: [], total: 0 });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { search: 'x' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(mockEvidenceService.searchEvidence).not.toHaveBeenCalled();
      expect(mockEvidenceService.getEvidenceForGuild).toHaveBeenCalled();
    });

    it('rejects unauthenticated requests (401)', async () => {
      mockApiGateFromRequest.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 401);
    });

    it('requires mod.evidence.view permission (403)', async () => {
      const gate = createMockGate({ authOk: false });
      mockApiGateFromRequest.mockResolvedValue(gate);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 403);
    });

    it('guild isolation: evidence scoped to guildId', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockEvidenceService.getEvidenceForGuild.mockResolvedValue({ evidence: [], total: 0 });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: 'guild-A' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockEvidenceService.getEvidenceForGuild).toHaveBeenCalledWith('guild-A', expect.anything());
    });
  });

  describe('POST /evidence (initiate)', () => {
    it('returns presigned upload URL', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockParseRequestBody.mockResolvedValue({
        action: 'initiate',
        caseNumber: 42,
        filename: 'photo.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
      });
      mockEvidenceService.initiateUpload.mockResolvedValue({
        evidenceId: 'ev-1',
        uploadUrl: 'https://upload.example.com',
      });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      const data = response.data as any;
      expect(data.evidenceId).toBe('ev-1');
      expect(data.uploadUrl).toBe('https://upload.example.com');
      expect(mockEvidenceService.initiateUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: '123456789',
          caseNumber: 42,
          filename: 'photo.png',
          mimeType: 'image/png',
          sizeBytes: 1024,
        })
      );
    });

    it('requires mod.evidence.add permission', async () => {
      const gate = createMockGate({ authOk: false });
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockParseRequestBody.mockResolvedValue({ action: 'initiate', caseNumber: 1, filename: 'f', mimeType: 'text/plain', sizeBytes: 1 });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 403);
    });

    it('weight gate blocks oversized uploads (413)', async () => {
      const gate = createMockGate({ weightOk: false });
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockParseRequestBody.mockResolvedValue({
        action: 'initiate',
        caseNumber: 1,
        filename: 'large.zip',
        mimeType: 'application/zip',
        sizeBytes: 500_000_000,
      });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 413);
    });

    it('validates required fields', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockParseRequestBody.mockResolvedValue({ action: 'initiate' }); // missing required fields

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
    });
  });

  describe('POST /evidence (confirm)', () => {
    it('verifies content hash', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockParseRequestBody.mockResolvedValue({
        action: 'confirm',
        evidenceId: 'ev-1',
        contentHash: 'abc123',
      });
      mockEvidenceService.confirmUpload.mockResolvedValue({ id: 'ev-1', status: 'VERIFIED' });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockEvidenceService.confirmUpload).toHaveBeenCalledWith('ev-1', 'abc123');
      const data = response.data as any;
      expect(data.id).toBe('ev-1');
      expect(data.status).toBe('VERIFIED');
    });

    it('rejects missing evidenceId or contentHash', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockParseRequestBody.mockResolvedValue({ action: 'confirm' });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
    });
  });

  describe('POST /evidence (url)', () => {
    it('adds URL evidence for valid URL', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockParseRequestBody.mockResolvedValue({
        action: 'url',
        caseNumber: 1,
        url: 'https://example.com/evidence.png',
      });
      mockEvidenceService.addUrlEvidence.mockResolvedValue({ id: 'ev-url' });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(mockEvidenceService.addUrlEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: '123456789',
          url: 'https://example.com/evidence.png',
        })
      );
    });

    it('rejects missing url or caseNumber', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockParseRequestBody.mockResolvedValue({ action: 'url' });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
    });
  });

  describe('POST /evidence (preview-og)', () => {
    it('fetches OG metadata without creating evidence', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockParseRequestBody.mockResolvedValue({ action: 'preview-og', url: 'https://example.com' });
      mockFetchOGData.mockResolvedValue({ title: 'Example', description: 'A site' });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      const data = response.data as any;
      expect(data.og).toEqual({ title: 'Example', description: 'A site' });
      expect(mockFetchOGData).toHaveBeenCalledWith('https://example.com');
      expect(mockEvidenceService.addUrlEvidence).not.toHaveBeenCalled();
    });
  });

  describe('POST /evidence (bulk-amend)', () => {
    it('amends multiple evidence items', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockParseRequestBody.mockResolvedValue({
        action: 'bulk-amend',
        evidenceIds: ['ev-1', 'ev-2'],
        amendAction: 'FLAGGED',
        reason: 'Batch flag',
      });
      mockEvidenceService.amendEvidence.mockResolvedValue({ id: 'amend-1' });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(mockEvidenceService.amendEvidence).toHaveBeenCalledTimes(2);
      const data = response.data as any;
      expect(data.results).toHaveLength(2);
    });

    it('rejects bulk over 25 items', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockParseRequestBody.mockResolvedValue({
        action: 'bulk-amend',
        evidenceIds: Array.from({ length: 26 }, (_, i) => `ev-${i}`),
        amendAction: 'FLAGGED',
      });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
      expect((response.data as any).error).toContain('25');
    });

    it('rejects empty evidenceIds', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockParseRequestBody.mockResolvedValue({
        action: 'bulk-amend',
        evidenceIds: [],
        amendAction: 'FLAGGED',
      });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
    });
  });

  describe('POST /evidence (unknown action)', () => {
    it('rejects unknown action', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockParseRequestBody.mockResolvedValue({ action: 'nonexistent' });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
    });
  });
});
