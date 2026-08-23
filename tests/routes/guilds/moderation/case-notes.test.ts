import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaseNotesRoute } from '#routes/guilds/moderation/cases/notes.js';
import {
  createMockRequest,
  createMockResponse,
  createMockContainer,
  expectStatus,
} from '../../../helpers/test-helpers.js';

// Hoisted mocks
const { mockApiGateFromRequest, mockCaseNoteService, mockParseRequestBody } = vi.hoisted(() => ({
  mockApiGateFromRequest: vi.fn(),
  mockCaseNoteService: {
    getNotes: vi.fn(),
    addNote: vi.fn(),
  },
  mockParseRequestBody: vi.fn(),
}));

vi.mock('#lib/validation/ApiGate.js', () => ({
  ApiGate: {
    fromRequest: mockApiGateFromRequest,
  },
}));

vi.mock('#lib/validation/RateLimitGate.js', () => ({
  RateLimitGate: {
    LIMITS: {
      'evidence.view': { maxRequests: 60, windowMs: 60_000 },
    },
  },
}));

vi.mock('#modules/moderation/services/CaseNoteService.js', () => ({
  caseNoteService: mockCaseNoteService,
}));

vi.mock('#lib/route-utils.js', () => ({
  parseRequestBody: mockParseRequestBody,
}));

function createMockGate(overrides: Partial<{
  userId: string;
  isAdmin: boolean;
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
  };
}

describe('CaseNotesRoute', () => {
  let route: CaseNotesRoute;
  let mockContainer: ReturnType<typeof createMockContainer>;
  const mockModCaseFindFirst = vi.fn();

  beforeEach(() => {
    mockContainer = createMockContainer();
    (mockContainer as any).prisma = {
      modCase: {
        findFirst: mockModCaseFindFirst,
      },
    };

    route = Object.create(CaseNotesRoute.prototype);
    Object.defineProperty(route, 'container', {
      get: () => mockContainer,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  describe('POST /cases/:caseNumber/notes', () => {
    it('creates a note with valid content', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockModCaseFindFirst.mockResolvedValue({ id: 'case-1', guildId: '123456789', caseNumber: 1 });
      mockParseRequestBody.mockResolvedValue({ content: 'This is a case note' });
      mockCaseNoteService.addNote.mockResolvedValue({
        id: 'note-1',
        content: 'This is a case note',
        authorId: 'user-123',
      });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789', caseNumber: '1' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 201);
      expect(mockCaseNoteService.addNote).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-1',
          guildId: '123456789',
          authorId: 'user-123',
          content: 'This is a case note',
        })
      );
    });

    it('rejects empty content', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockModCaseFindFirst.mockResolvedValue({ id: 'case-1', guildId: '123456789', caseNumber: 1 });
      mockParseRequestBody.mockResolvedValue({ content: '' });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789', caseNumber: '1' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
      expect((response.data as any).error).toContain('content is required');
    });

    it('rejects whitespace-only content', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockModCaseFindFirst.mockResolvedValue({ id: 'case-1', guildId: '123456789', caseNumber: 1 });
      mockParseRequestBody.mockResolvedValue({ content: '   ' });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789', caseNumber: '1' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
      expect((response.data as any).error).toContain('content is required');
    });

    it('rejects content over 2000 characters', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockModCaseFindFirst.mockResolvedValue({ id: 'case-1', guildId: '123456789', caseNumber: 1 });
      mockParseRequestBody.mockResolvedValue({ content: 'x'.repeat(2001) });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789', caseNumber: '1' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
      expect((response.data as any).error).toContain('2000');
    });

    it('requires mod.cases.edit permission', async () => {
      const gate = createMockGate({ authOk: false });
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockModCaseFindFirst.mockResolvedValue({ id: 'case-1', guildId: '123456789', caseNumber: 1 });
      mockParseRequestBody.mockResolvedValue({ content: 'test' });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: '123456789', caseNumber: '1' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 403);
      expect(gate.checkAuth).toHaveBeenCalledWith('mod.cases.edit');
    });
  });

  describe('GET /cases/:caseNumber/notes', () => {
    it('returns paginated notes', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockModCaseFindFirst.mockResolvedValue({ id: 'case-1', guildId: '123456789', caseNumber: 1 });
      mockCaseNoteService.getNotes.mockResolvedValue({
        notes: [{ id: 'note-1', content: 'A note' }],
        total: 1,
      });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789', caseNumber: '1' },
        query: { page: '1', limit: '10' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      const data = response.data as any;
      expect(data.notes).toHaveLength(1);
      expect(data.notes[0].id).toBe('note-1');
      expect(data.total).toBe(1);
      expect(mockCaseNoteService.getNotes).toHaveBeenCalledWith('case-1', { page: 1, limit: 10 });
    });

    it('requires mod.cases.view permission', async () => {
      const gate = createMockGate({ authOk: false });
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockModCaseFindFirst.mockResolvedValue({ id: 'case-1', guildId: '123456789', caseNumber: 1 });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789', caseNumber: '1' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 403);
      expect(gate.checkAuth).toHaveBeenCalledWith('mod.cases.view');
    });
  });

  describe('shared validation', () => {
    it('rejects unauthenticated requests (401)', async () => {
      mockApiGateFromRequest.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789', caseNumber: '1' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 401);
    });

    it('returns 404 for non-existent case', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockModCaseFindFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789', caseNumber: '999' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 404);
    });

    it('rejects invalid case number', async () => {
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789', caseNumber: 'abc' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
    });

    it('rejects caseNumber=0', async () => {
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789', caseNumber: '0' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
      expect((response.data as any).error).toContain('Invalid case number');
    });

    it('rejects negative case number', async () => {
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789', caseNumber: '-5' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
    });
  });
});
