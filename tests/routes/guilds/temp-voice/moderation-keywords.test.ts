/**
 * Unit tests for Moderation Keywords Routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TempVoiceModerationKeywordsGetRoute } from '../../../../src/routes/guilds/temp-voice/moderation/keywords-get.js';
import { TempVoiceModerationKeywordsPatchRoute } from '../../../../src/routes/guilds/temp-voice/moderation/keywords-patch.js';
import { createMockRequest, createMockResponse, createMockContainer, expectSuccess, expectError } from '../../../helpers/test-helpers.js';

const { mockApiGateFromRequest } = vi.hoisted(() => ({
  mockApiGateFromRequest: vi.fn(),
}));

vi.mock('#lib/validation/ApiGate.js', () => ({
  ApiGate: { fromRequest: mockApiGateFromRequest },
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

// Create shared mock functions
const mockGetPendingKeywords = vi.fn();
const mockGetQueueStats = vi.fn();
const mockApproveKeyword = vi.fn();
const mockDenyKeyword = vi.fn();
const mockIgnoreKeyword = vi.fn();

// Mock KeywordQueueService
vi.mock('#modules/temp-voice/services/moderation/keyword-queue.service.js', () => ({
  KeywordQueueService: class {
    getPendingKeywords = mockGetPendingKeywords;
    getQueueStats = mockGetQueueStats;
    approveKeyword = mockApproveKeyword;
    denyKeyword = mockDenyKeyword;
    ignoreKeyword = mockIgnoreKeyword;
  },
  KeywordSource: {
    MANUAL_REPORT: 'MANUAL_REPORT',
    AUTO_DETECTED: 'AUTO_DETECTED',
    DISCOVERY_REVOCATION: 'DISCOVERY_REVOCATION',
  },
}));

describe('Moderation Keywords Routes', () => {
  let mockContainer: ReturnType<typeof createMockContainer>;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {};

    mockContainer = createMockContainer();
    mockContainer.prisma = mockPrisma;
    mockApiGateFromRequest.mockResolvedValue(createMockGate());

    vi.clearAllMocks();
    mockApiGateFromRequest.mockResolvedValue(createMockGate());
  });

  describe('GET /guilds/:guildId/temp-voice/moderation/keywords', () => {
    let route: TempVoiceModerationKeywordsGetRoute;

    beforeEach(() => {
      route = Object.create(TempVoiceModerationKeywordsGetRoute.prototype);
      Object.defineProperty(route, 'container', {
        get: () => mockContainer,
        configurable: true,
      });
    });

    it('should return pending keywords with stats', async () => {
      const mockKeywords = [
        {
          id: 'keyword-1',
          keyword: 'BadWord',
          normalizedKeyword: 'badword',
          source: 'MANUAL_REPORT',
          status: 'PENDING',
          occurrences: 3,
          contextSnippet: 'Test channel',
          channelId: 'channel-1',
          userId: 'user-1',
          lastSeenAt: new Date(),
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockStats = {
        pending: 5,
        approved: 10,
        denied: 2,
        ignored: 3,
        totalPatterns: 15,
      };

      mockGetPendingKeywords.mockResolvedValue(mockKeywords as any);
      mockGetQueueStats.mockResolvedValue(mockStats);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: 'guild-123' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.success).toBe(true);
      expect(data.data.keywords).toHaveLength(1);
      expect(data.data.keywords[0].keyword).toBe('BadWord');
      expect(data.data.stats).toEqual(mockStats);
    });

    it('should return error for missing guildId', async () => {
      const request = createMockRequest({
        method: 'GET',
        params: {},
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectError(response, 400);
      const data = response.data as any;
      expect(data.error.code).toBe('MISSING_GUILD_ID');
    });

    it('should apply query filters', async () => {
      mockGetPendingKeywords.mockResolvedValue([]);
      mockGetQueueStats.mockResolvedValue({
        pending: 0,
        approved: 0,
        denied: 0,
        ignored: 0,
        totalPatterns: 0,
      });

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: 'guild-123' },
        url: 'http://localhost/test?limit=10&offset=5&minOccurrences=2',
      });
      request.query = {
        limit: '10',
        offset: '5',
        minOccurrences: '2',
      };

      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
    });
  });

  describe('PATCH /guilds/:guildId/temp-voice/moderation/keywords/:keywordId', () => {
    let route: TempVoiceModerationKeywordsPatchRoute;

    beforeEach(() => {
      route = Object.create(TempVoiceModerationKeywordsPatchRoute.prototype);
      Object.defineProperty(route, 'container', {
        get: () => mockContainer,
        configurable: true,
      });
    });

    it('should approve a keyword', async () => {
      const mockResult = {
        id: 'keyword-1',
        keyword: 'BadWord',
        status: 'APPROVED',
        patternCreated: true,
        patternId: 'pattern-1',
      };

      mockApproveKeyword.mockResolvedValue(mockResult as any);

      const request = createMockRequest({
        method: 'PATCH',
        params: { guildId: 'guild-123', keywordId: 'keyword-1' },
        body: {
          action: 'approve',
          reviewedBy: 'admin-1',
          reviewNote: 'Clearly inappropriate',
        },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.success).toBe(true);
      expect(data.data.keyword).toBe('BadWord');
      expect(data.data.patternId).toBe('pattern-1');
    });

    it('should deny a keyword', async () => {
      const mockResult = {
        id: 'keyword-1',
        keyword: 'CleanWord',
        status: 'DENIED',
        patternCreated: false,
      };

      mockDenyKeyword.mockResolvedValue(mockResult as any);

      const request = createMockRequest({
        method: 'PATCH',
        params: { guildId: 'guild-123', keywordId: 'keyword-1' },
        body: {
          action: 'deny',
          reviewedBy: 'admin-1',
          reviewNote: 'False positive',
        },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.success).toBe(true);
      expect(data.data.keyword).toBe('CleanWord');
    });

    it('should ignore a keyword', async () => {
      const mockResult = {
        id: 'keyword-1',
        keyword: 'IgnoredWord',
        status: 'IGNORED',
      };

      mockIgnoreKeyword.mockResolvedValue(mockResult as any);

      const request = createMockRequest({
        method: 'PATCH',
        params: { guildId: 'guild-123', keywordId: 'keyword-1' },
        body: {
          action: 'ignore',
          reviewedBy: 'admin-1',
        },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.success).toBe(true);
      expect(data.data.keyword).toBe('IgnoredWord');
    });

    it('should return error for invalid action', async () => {
      const request = createMockRequest({
        method: 'PATCH',
        params: { guildId: 'guild-123', keywordId: 'keyword-1' },
        body: {
          action: 'invalid',
          reviewedBy: 'admin-1',
        },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectError(response, 400);
      const data = response.data as any;
      expect(data.error.code).toBe('INVALID_ACTION');
    });

    it('should derive reviewedBy from authenticated session', async () => {
      mockApproveKeyword.mockResolvedValue({
        id: 'keyword-1',
        keyword: 'BadWord',
        status: 'APPROVED',
        patternCreated: true,
        patternId: 'pattern-1',
      });

      const request = createMockRequest({
        method: 'PATCH',
        params: { guildId: 'guild-123', keywordId: 'keyword-1' },
        body: {
          action: 'approve',
          // No reviewedBy — should be derived from gate.userId
        },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.data.reviewedBy).toBe('user-123');
    });

    it('should handle service errors gracefully', async () => {
      mockApproveKeyword.mockRejectedValue(new Error('Keyword not found'));

      const request = createMockRequest({
        method: 'PATCH',
        params: { guildId: 'guild-123', keywordId: 'invalid-id' },
        body: {
          action: 'approve',
          reviewedBy: 'admin-1',
        },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectError(response, 400);
      const data = response.data as any;
      expect(data.error.code).toBe('ACTION_FAILED');
    });
  });
});
