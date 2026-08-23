import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsRoute } from '#routes/guilds/moderation/analytics.js';
import {
  createMockRequest,
  createMockResponse,
  createMockContainer,
  expectStatus,
} from '../../../helpers/test-helpers.js';

// Hoisted mocks
const { mockApiGateFromRequest, mockAnalyticsService } = vi.hoisted(() => ({
  mockApiGateFromRequest: vi.fn(),
  mockAnalyticsService: {
    getAnalytics: vi.fn(),
    getCaseAnalytics: vi.fn(),
  },
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

vi.mock('#modules/moderation/services/AnalyticsService.js', () => ({
  analyticsService: mockAnalyticsService,
}));

function createMockGate(overrides: Partial<{
  authOk: boolean;
  rateLimitOk: boolean;
}> = {}) {
  return {
    userId: 'user-123',
    checkAuth: vi.fn().mockResolvedValue({
      ok: overrides.authOk ?? true,
      code: overrides.authOk === false ? 'NO_PERMISSION' : undefined,
      metadata: overrides.authOk === false ? {} : undefined,
    }),
    checkRateLimit: vi.fn().mockResolvedValue({
      ok: overrides.rateLimitOk ?? true,
      metadata: overrides.rateLimitOk === false ? { retryAfterMs: 5000 } : undefined,
    }),
  };
}

describe('AnalyticsRoute', () => {
  let route: AnalyticsRoute;
  let mockContainer: ReturnType<typeof createMockContainer>;

  beforeEach(() => {
    mockContainer = createMockContainer();
    route = Object.create(AnalyticsRoute.prototype);
    Object.defineProperty(route, 'container', {
      get: () => mockContainer,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  describe('GET /guilds/:guildId/moderation/analytics', () => {
    it('returns evidence analytics with default period (30d)', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const analyticsData = { totalEvidence: 100, byType: { IMAGE: 50, VIDEO: 50 } };
      mockAnalyticsService.getAnalytics.mockResolvedValue(analyticsData);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(mockAnalyticsService.getAnalytics).toHaveBeenCalledWith('123456789', '30d');
      expect(response.data).toEqual(analyticsData);
    });

    it('period parameter 7d filters correctly', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockAnalyticsService.getAnalytics.mockResolvedValue({});

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { period: '7d' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockAnalyticsService.getAnalytics).toHaveBeenCalledWith('123456789', '7d');
    });

    it('period parameter 90d filters correctly', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockAnalyticsService.getAnalytics.mockResolvedValue({});

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { period: '90d' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockAnalyticsService.getAnalytics).toHaveBeenCalledWith('123456789', '90d');
    });

    it('invalid period falls back to 30d', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockAnalyticsService.getAnalytics.mockResolvedValue({});

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { period: 'invalid' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockAnalyticsService.getAnalytics).toHaveBeenCalledWith('123456789', '30d');
    });

    it('type=cases returns case analytics', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      const caseData = { totalCases: 42 };
      mockAnalyticsService.getCaseAnalytics.mockResolvedValue(caseData);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { type: 'cases' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 200);
      expect(mockAnalyticsService.getCaseAnalytics).toHaveBeenCalledWith('123456789', '30d');
      expect(response.data).toEqual(caseData);
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

    it('rejects users without permission (403)', async () => {
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

    it('returns 429 when rate limited', async () => {
      const gate = createMockGate({ rateLimitOk: false });
      mockApiGateFromRequest.mockResolvedValue(gate);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 429);
    });

    it('guild isolation: analytics scoped to guildId', async () => {
      const gate = createMockGate();
      mockApiGateFromRequest.mockResolvedValue(gate);
      mockAnalyticsService.getAnalytics.mockResolvedValue({});

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: 'guild-A' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expect(mockAnalyticsService.getAnalytics).toHaveBeenCalledWith('guild-A', '30d');
    });
  });
});
