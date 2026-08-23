/**
 * Unit tests for Moderation Patterns Routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse, createMockContainer, expectSuccess, expectError } from '../../../helpers/test-helpers.js';
import { TempVoiceModerationPatternsGetRoute } from '../../../../src/routes/guilds/temp-voice/moderation/patterns-get.js';
import { TempVoiceModerationPatternsPostRoute } from '../../../../src/routes/guilds/temp-voice/moderation/patterns-post.js';
import { TempVoiceModerationPatternsPatchRoute } from '../../../../src/routes/guilds/temp-voice/moderation/patterns-patch.js';
import { TempVoiceModerationPatternsDeleteRoute } from '../../../../src/routes/guilds/temp-voice/moderation/patterns-delete.js';

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

describe('Moderation Patterns Routes', () => {
  let mockContainer: ReturnType<typeof createMockContainer>;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      tempVoiceModerationPattern: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    mockContainer = createMockContainer({
      logger: {
        error: (...args) => console.log('[TEST ERROR]', ...args),
      },
    });
    mockContainer.prisma = mockPrisma;
    mockApiGateFromRequest.mockResolvedValue(createMockGate());

    vi.clearAllMocks();
    mockApiGateFromRequest.mockResolvedValue(createMockGate());
  });

  describe('GET /guilds/:guildId/temp-voice/moderation/patterns', () => {
    let route: TempVoiceModerationPatternsGetRoute;

    beforeEach(() => {
      route = Object.create(TempVoiceModerationPatternsGetRoute.prototype);
      Object.defineProperty(route, 'container', {
        get: () => mockContainer,
        configurable: true,
      });
    });

    it('should return all patterns', async () => {
      const mockPatterns = [
        {
          id: 'pattern-1',
          pattern: 'bad.*word',
          patternType: 'PROFANITY',
          description: 'Test pattern',
          severity: 8,
          enabled: true,
          caseInsensitive: true,
          matchCount: 5,
          lastMatchedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.tempVoiceModerationPattern.findMany.mockResolvedValue(mockPatterns);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: 'guild-123' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.success).toBe(true);
      expect(data.data.patterns).toHaveLength(1);
      expect(data.data.patterns[0].pattern).toBe('bad.*word');
    });

    it('should filter by patternType', async () => {
      mockPrisma.tempVoiceModerationPattern.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: 'guild-123' },
        url: 'http://localhost/test?patternType=PROFANITY',
      });
      request.query = { patternType: 'PROFANITY' };

      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      expect(mockPrisma.tempVoiceModerationPattern.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ patternType: 'PROFANITY' }),
        })
      );
    });

    it('should filter by enabled status', async () => {
      mockPrisma.tempVoiceModerationPattern.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: 'guild-123' },
        url: 'http://localhost/test?enabled=true',
      });
      request.query = { enabled: 'true' };

      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      expect(mockPrisma.tempVoiceModerationPattern.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ enabled: true }),
        })
      );
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
  });

  describe('POST /guilds/:guildId/temp-voice/moderation/patterns', () => {
    let route: TempVoiceModerationPatternsPostRoute;

    beforeEach(() => {
      route = Object.create(TempVoiceModerationPatternsPostRoute.prototype);
      Object.defineProperty(route, 'container', {
        get: () => mockContainer,
        configurable: true,
      });
    });

    it('should create a new pattern', async () => {
      const mockPattern = {
        id: 'pattern-1',
        pattern: 'test.*pattern',
        patternType: 'SPAM',
        description: 'Test spam pattern',
        severity: 5,
        enabled: true,
        createdAt: new Date(),
      };

      mockPrisma.tempVoiceModerationPattern.create.mockResolvedValue(mockPattern);

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: 'guild-123' },
        body: {
          pattern: 'test.*pattern',
          patternType: 'SPAM',
          description: 'Test spam pattern',
        },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response, true);
      const data = response.data as any;
      expect(data.success).toBe(true);
      expect(data.data.pattern).toBe('test.*pattern');
      expect(response.statusCode).toBe(201);
    });

    it('should use default severity if not provided', async () => {
      mockPrisma.tempVoiceModerationPattern.create.mockResolvedValue({
        id: 'pattern-1',
        pattern: 'test',
        patternType: 'OTHER',
        severity: 5,
        enabled: true,
        createdAt: new Date(),
      });

      const request = createMockRequest({
        method: 'POST',
        params: { guildId: 'guild-123' },
        body: {
          pattern: 'test',
          patternType: 'OTHER',
        },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response, true);
      expect(mockPrisma.tempVoiceModerationPattern.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ severity: 5 }),
        })
      );
    });

    it('should return error for invalid regex pattern', async () => {
      const request = createMockRequest({
        method: 'POST',
        params: { guildId: 'guild-123' },
        body: {
          pattern: '[invalid(regex',
          patternType: 'PROFANITY',
        },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectError(response, 400);
      const data = response.data as any;
      expect(data.error.code).toBe('INVALID_PATTERN');
    });

    it('should return error for invalid patternType', async () => {
      const request = createMockRequest({
        method: 'POST',
        params: { guildId: 'guild-123' },
        body: {
          pattern: 'test',
          patternType: 'INVALID_TYPE',
        },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectError(response, 400);
      const data = response.data as any;
      expect(data.error.code).toBe('INVALID_TYPE');
    });

    it('should return error for missing required fields', async () => {
      const request = createMockRequest({
        method: 'POST',
        params: { guildId: 'guild-123' },
        body: {
          pattern: 'test',
          // Missing patternType
        },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectError(response, 400);
      const data = response.data as any;
      expect(data.error.code).toBe('MISSING_FIELDS');
    });
  });

  describe('PATCH /guilds/:guildId/temp-voice/moderation/patterns/:patternId', () => {
    let route: TempVoiceModerationPatternsPatchRoute;

    beforeEach(() => {
      route = Object.create(TempVoiceModerationPatternsPatchRoute.prototype);
      Object.defineProperty(route, 'container', {
        get: () => mockContainer,
        configurable: true,
      });
    });

    it('should update pattern enabled status', async () => {
      const existingPattern = {
        id: 'pattern-1',
        pattern: 'test',
        patternType: 'SPAM',
        enabled: true,
      };

      const updatedPattern = {
        ...existingPattern,
        enabled: false,
        updatedAt: new Date(),
      };

      mockPrisma.tempVoiceModerationPattern.findUnique.mockResolvedValue(existingPattern);
      mockPrisma.tempVoiceModerationPattern.update.mockResolvedValue(updatedPattern);

      const request = createMockRequest({
        method: 'PATCH',
        params: { guildId: 'guild-123', patternId: 'pattern-1' },
        body: {
          enabled: false,
        },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.success).toBe(true);
      expect(data.data.enabled).toBe(false);
    });

    it('should update pattern description', async () => {
      const existingPattern = {
        id: 'pattern-1',
        pattern: 'test',
        description: 'Old description',
      };

      const updatedPattern = {
        ...existingPattern,
        description: 'New description',
      };

      mockPrisma.tempVoiceModerationPattern.findUnique.mockResolvedValue(existingPattern);
      mockPrisma.tempVoiceModerationPattern.update.mockResolvedValue(updatedPattern);

      const request = createMockRequest({
        method: 'PATCH',
        params: { guildId: 'guild-123', patternId: 'pattern-1' },
        body: {
          description: 'New description',
        },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.data.description).toBe('New description');
    });

    it('should return error for pattern not found', async () => {
      mockPrisma.tempVoiceModerationPattern.findUnique.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'PATCH',
        params: { guildId: 'guild-123', patternId: 'invalid-id' },
        body: {
          enabled: false,
        },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectError(response, 404);
      const data = response.data as any;
      expect(data.error.code).toBe('PATTERN_NOT_FOUND');
    });

    it('should return error for no valid updates', async () => {
      mockPrisma.tempVoiceModerationPattern.findUnique.mockResolvedValue({
        id: 'pattern-1',
        pattern: 'test',
      });

      const request = createMockRequest({
        method: 'PATCH',
        params: { guildId: 'guild-123', patternId: 'pattern-1' },
        body: {},
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectError(response, 400);
      const data = response.data as any;
      expect(data.error.code).toBe('NO_UPDATES');
    });
  });

  describe('DELETE /guilds/:guildId/temp-voice/moderation/patterns/:patternId', () => {
    let route: TempVoiceModerationPatternsDeleteRoute;

    beforeEach(() => {
      route = Object.create(TempVoiceModerationPatternsDeleteRoute.prototype);
      Object.defineProperty(route, 'container', {
        get: () => mockContainer,
        configurable: true,
      });
    });

    it('should delete a pattern', async () => {
      const existingPattern = {
        id: 'pattern-1',
        pattern: 'test.*pattern',
        patternType: 'SPAM',
      };

      mockPrisma.tempVoiceModerationPattern.findUnique.mockResolvedValue(existingPattern);
      mockPrisma.tempVoiceModerationPattern.delete.mockResolvedValue(existingPattern);

      const request = createMockRequest({
        method: 'DELETE',
        params: { guildId: 'guild-123', patternId: 'pattern-1' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.success).toBe(true);
      expect(data.data.deletedPattern.id).toBe('pattern-1');
      expect(mockPrisma.tempVoiceModerationPattern.delete).toHaveBeenCalledWith({
        where: { id: 'pattern-1' },
      });
    });

    it('should return error for pattern not found', async () => {
      mockPrisma.tempVoiceModerationPattern.findUnique.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'DELETE',
        params: { guildId: 'guild-123', patternId: 'invalid-id' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectError(response, 404);
      const data = response.data as any;
      expect(data.error.code).toBe('PATTERN_NOT_FOUND');
    });

    it('should return error for missing parameters', async () => {
      const request = createMockRequest({
        method: 'DELETE',
        params: { guildId: 'guild-123' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectError(response, 400);
      const data = response.data as any;
      expect(data.error.code).toBe('MISSING_PARAMETERS');
    });
  });
});
