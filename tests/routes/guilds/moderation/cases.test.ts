import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModerationCasesRoute } from '#routes/guilds/moderation/cases/index.js';
import {
  createMockRequest,
  createMockResponse,
  createMockContainer,
  expectSuccess,
  expectError,
  expectStatus,
} from '../../../helpers/test-helpers.js';

const { mockApiGateFromRequest } = vi.hoisted(() => ({
  mockApiGateFromRequest: vi.fn(),
}));

vi.mock('#lib/validation/ApiGate.js', () => ({
  ApiGate: {
    fromRequest: mockApiGateFromRequest,
  },
}));

vi.mock('#lib/validation/modAction.js', () => ({
  parseModAction: vi.fn((action: string) => {
    const valid = ['BAN', 'KICK', 'WARN', 'TIMEOUT', 'MUTE', 'UNMUTE', 'UNBAN'];
    return valid.includes(action) ? action : undefined;
  }),
}));

function createMockGate(overrides: Partial<{ authOk: boolean }> = {}) {
  return {
    userId: 'user-123',
    isAdmin: false,
    checkAuth: vi.fn().mockResolvedValue({
      ok: overrides.authOk ?? true,
      code: overrides.authOk === false ? 'NO_PERMISSION' : undefined,
    }),
  };
}

describe('ModerationCasesRoute', () => {
  let route: ModerationCasesRoute;
  let mockContainer: ReturnType<typeof createMockContainer>;
  const mockModCaseCount = vi.fn();
  const mockModCaseFindMany = vi.fn();

  beforeEach(() => {
    mockContainer = createMockContainer();
    (mockContainer as any).prisma = {
      modCase: {
        count: mockModCaseCount,
        findMany: mockModCaseFindMany,
      },
    };

    route = Object.create(ModerationCasesRoute.prototype);
    Object.defineProperty(route, 'container', {
      get: () => mockContainer,
      configurable: true,
    });

    // Default: authenticated with access
    mockApiGateFromRequest.mockResolvedValue(createMockGate());

    vi.clearAllMocks();
    mockApiGateFromRequest.mockResolvedValue(createMockGate());
  });

  describe('GET /guilds/:guildId/moderation/cases', () => {
    it('returns paginated results', async () => {
      const cases = [
        { id: 'case-1', caseNumber: 1, action: 'WARN', guildId: '123456789' },
        { id: 'case-2', caseNumber: 2, action: 'BAN', guildId: '123456789' },
      ];
      mockModCaseCount.mockResolvedValue(50);
      mockModCaseFindMany.mockResolvedValue(cases);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { page: '1', limit: '10' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.total).toBe(50);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(10);
      expect(data.totalPages).toBe(5);
      expect(data.cases).toHaveLength(2);
    });

    it('filters by status', async () => {
      mockModCaseCount.mockResolvedValue(0);
      mockModCaseFindMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { status: 'OPEN' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockModCaseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'OPEN' }),
        })
      );
    });

    it('applies combined filters (action, targetId, status)', async () => {
      mockModCaseCount.mockResolvedValue(0);
      mockModCaseFindMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { action: 'BAN', targetId: 'user-456', status: 'OPEN' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockModCaseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: 'BAN',
            targetId: 'user-456',
            status: 'OPEN',
          }),
        })
      );
    });

    it('defaults to page=1, limit=50 when no pagination params', async () => {
      mockModCaseCount.mockResolvedValue(0);
      mockModCaseFindMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockModCaseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 50,
        })
      );
    });

    it('filters by action type', async () => {
      mockModCaseCount.mockResolvedValue(0);
      mockModCaseFindMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { action: 'BAN' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockModCaseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ action: 'BAN' }),
        })
      );
    });

    it('filters by targetId', async () => {
      mockModCaseCount.mockResolvedValue(0);
      mockModCaseFindMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { targetId: 'user-123' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockModCaseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ targetId: 'user-123' }),
        })
      );
    });

    it('search by user tag works', async () => {
      mockModCaseCount.mockResolvedValue(0);
      mockModCaseFindMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { search: 'TestUser' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockModCaseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ targetTag: { contains: 'TestUser', mode: 'insensitive' } }),
            ]),
          }),
        })
      );
    });

    it('sort order (asc/desc) works', async () => {
      mockModCaseCount.mockResolvedValue(0);
      mockModCaseFindMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { sort: 'caseNumber', order: 'asc' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockModCaseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { caseNumber: 'asc' },
        })
      );
    });

    it('rejects invalid sort fields', async () => {
      mockModCaseCount.mockResolvedValue(0);
      mockModCaseFindMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { sort: 'password' }, // SQL injection attempt
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      // Should fall back to createdAt
      expect(mockModCaseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('caps limit at 100', async () => {
      mockModCaseCount.mockResolvedValue(0);
      mockModCaseFindMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { limit: '500' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockModCaseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });

    it('returns 401 when ApiGate cannot resolve session', async () => {
      mockApiGateFromRequest.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: 'nonexistent-guild' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectError(response, 401);
    });

    it('returns 403 when user lacks mod.case permission', async () => {
      mockApiGateFromRequest.mockResolvedValue(createMockGate({ authOk: false }));

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectError(response, 403);
    });

    it('returns 400 when guildId missing', async () => {
      const request = createMockRequest({
        method: 'GET',
        params: {},
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
    });

    it('guild isolation: cases scoped to guildId', async () => {
      mockModCaseCount.mockResolvedValue(0);
      mockModCaseFindMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockModCaseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ guildId: '123456789' }),
        })
      );
    });
  });
});
