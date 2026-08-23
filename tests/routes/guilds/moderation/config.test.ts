import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModerationConfigRoute } from '#routes/guilds/moderation/config.js';
import {
  createMockRequest,
  createMockResponse,
  createMockContainer,
  expectStatus,
  expectSuccess,
} from '../../../helpers/test-helpers.js';

// Hoisted mocks
const { mockParseRequestBody, mockValidateDto } = vi.hoisted(() => ({
  mockParseRequestBody: vi.fn(),
  mockValidateDto: vi.fn(),
}));

vi.mock('#lib/route-utils.js', () => ({
  parseRequestBody: mockParseRequestBody,
}));

vi.mock('#lib/validation/validate-dto.js', () => ({
  validateDto: mockValidateDto,
}));

vi.mock('#lib/dtos/moderation/moderation-config.dto.js', () => ({
  UpdateModConfigDto: class UpdateModConfigDto {},
}));

describe('ModerationConfigRoute', () => {
  let route: ModerationConfigRoute;
  let mockContainer: ReturnType<typeof createMockContainer>;
  const mockModConfigFindUnique = vi.fn();
  const mockModConfigUpsert = vi.fn();

  beforeEach(() => {
    // Create container with guild in cache and channels/roles
    const mockGuild = {
      id: '123456789',
      name: 'Test Guild',
      channels: {
        cache: new Map([
          ['channel-1', { id: 'channel-1', isTextBased: () => true }],
          ['channel-2', { id: 'channel-2', isTextBased: () => false }],
        ]),
      },
      roles: {
        cache: new Map([
          ['role-1', { id: 'role-1', name: 'Muted' }],
        ]),
      },
    };

    const guildsCache = new Map([['123456789', mockGuild]]);
    mockContainer = createMockContainer({
      client: { guilds: { cache: guildsCache } },
    });
    (mockContainer as any).prisma = {
      modConfig: {
        findUnique: mockModConfigFindUnique,
        upsert: mockModConfigUpsert,
      },
    };

    route = Object.create(ModerationConfigRoute.prototype);
    Object.defineProperty(route, 'container', {
      get: () => mockContainer,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  describe('GET /moderation/config', () => {
    it('returns guild moderation config', async () => {
      const config = {
        guildId: '123456789',
        modLogChannelId: 'channel-1',
        muteRoleId: 'role-1',
        autoModEnabled: true,
        watermarkDownloads: false,
        watermarkText: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockModConfigFindUnique.mockResolvedValue(config);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.guildId).toBe('123456789');
      expect(data.modLogChannelId).toBe('channel-1');
    });

    it('returns defaults when no config exists', async () => {
      mockModConfigFindUnique.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.guildId).toBe('123456789');
      expect(data.autoModEnabled).toBe(false);
      expect(data.watermarkDownloads).toBe(true);
      expect(data.modLogChannelId).toBeNull();
      expect(data.muteRoleId).toBeNull();
      expect(data.watermarkText).toBeNull();
    });

    it('returns 404 for guild not in cache', async () => {
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: 'nonexistent-guild' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 404);
    });
  });

  describe('PUT /moderation/config', () => {
    it('updates config with valid data', async () => {
      const updatedConfig = {
        guildId: '123456789',
        modLogChannelId: 'channel-1',
        autoModEnabled: true,
        watermarkDownloads: true,
      };
      mockParseRequestBody.mockResolvedValue({
        modLogChannelId: 'channel-1',
        autoModEnabled: true,
        watermarkDownloads: true,
      });
      mockValidateDto.mockResolvedValue({
        success: true,
        data: { modLogChannelId: 'channel-1', autoModEnabled: true, watermarkDownloads: true },
      });
      mockModConfigUpsert.mockResolvedValue(updatedConfig);

      const request = createMockRequest({
        method: 'PUT',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      expect(mockModConfigUpsert).toHaveBeenCalledWith({
        where: { guildId: '123456789' },
        update: expect.objectContaining({
          modLogChannelId: 'channel-1',
          autoModEnabled: true,
          watermarkDownloads: true,
        }),
        create: expect.objectContaining({
          guildId: '123456789',
          modLogChannelId: 'channel-1',
          autoModEnabled: true,
          watermarkDownloads: true,
        }),
      });
    });

    it('rejects channel ID not in guild cache', async () => {
      mockParseRequestBody.mockResolvedValue({ modLogChannelId: 'nonexistent-channel' });
      mockValidateDto.mockResolvedValue({
        success: true,
        data: { modLogChannelId: 'nonexistent-channel' },
      });

      const request = createMockRequest({
        method: 'PUT',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
      expect((response.data as any).error).toContain('Invalid channel ID');
    });

    it('rejects non-text channel for modLogChannelId', async () => {
      mockParseRequestBody.mockResolvedValue({ modLogChannelId: 'channel-2' });
      mockValidateDto.mockResolvedValue({
        success: true,
        data: { modLogChannelId: 'channel-2' },
      });

      const request = createMockRequest({
        method: 'PUT',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
      expect((response.data as any).error).toContain('not text-based');
    });

    it('rejects invalid config values', async () => {
      mockParseRequestBody.mockResolvedValue({ autoModEnabled: 'not-a-boolean' });
      mockValidateDto.mockResolvedValue({
        success: false,
        errors: [{ field: 'autoModEnabled', message: 'Must be a boolean' }],
      });

      const request = createMockRequest({
        method: 'PUT',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
    });
  });
});
