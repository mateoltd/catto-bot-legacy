import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Guild, GuildMember, GuildChannelManager, CategoryChannel, TextChannel, Webhook } from 'discord.js';

// Mock Sapphire container to prevent logger errors
vi.mock('@sapphire/framework', () => {
  const mockPrismaUpsert = vi.fn();
  return {
    container: {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
      client: {
        guilds: {
          cache: new Map(),
        },
      },
      prisma: {
        logConfig: {
          upsert: mockPrismaUpsert,
        },
      },
    },
  };
});

// Mock CONFIG to prevent environment variable errors
vi.mock('#config.js', () => ({
  CONFIG: {
    NODE_ENV: 'development',
    DISCORD_TOKEN: 'test-token',
    CLIENT_ID: 'test-client-id',
    CLIENT_SECRET: 'test-client-secret',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    API_PORT: 4000,
    API_PREFIX: 'api',
    API_ORIGIN: '*',
    API_REDIRECT: 'http://localhost:3000',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_DB: 0,
    DEFAULT_PREFIX: '!',
    OWNER_IDS: [],
  },
}));

vi.mock('#lib/route-utils.js', () => ({
  parseRequestBody: vi.fn((req) => Promise.resolve(req.body)),
}));

vi.mock('bullmq', () => ({
  Queue: class MockQueue {
    add() { return Promise.resolve({}); }
    close() { return Promise.resolve(undefined); }
  },
  Worker: class MockWorker {
    on() { return this; }
    close() { return Promise.resolve(undefined); }
  },
}));

import { LoggingSetupRoute } from '#routes/guilds/logging/setup.js';
import { container } from '@sapphire/framework';

describe('LoggingSetupRoute', () => {
  let route: LoggingSetupRoute;
  let mockGuild: Partial<Guild>;
  let mockBotMember: Partial<GuildMember>;
  let mockCategoryChannel: Partial<CategoryChannel>;
  let mockTextChannel: Partial<TextChannel>;
  let mockWebhook: Partial<Webhook>;
  let mockPrismaUpsert: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaUpsert = (container as any).prisma.logConfig.upsert;
    mockPrismaUpsert.mockResolvedValue({});

    // Create mock webhook
    mockWebhook = {
      url: 'https://discord.com/api/webhooks/123/abc',
    } as unknown as Partial<Webhook>;

    // Create mock text channel
    mockTextChannel = {
      id: 'channel-123',
      name: 'message-logs',
      createWebhook: vi.fn().mockResolvedValue(mockWebhook),
    } as unknown as Partial<TextChannel>;

    // Create mock category
    mockCategoryChannel = {
      id: 'category-123',
      name: 'Admin Logs',
    } as unknown as Partial<CategoryChannel>;

    // Create mock channels manager
    const mockChannelsManager = {
      create: vi.fn().mockImplementation((options) => {
        if (options.type === 4) { // GuildCategory
          return Promise.resolve(mockCategoryChannel);
        }
        return Promise.resolve(mockTextChannel);
      }),
    } as unknown as GuildChannelManager;

    // Create mock bot member
    mockBotMember = {
      id: 'bot-123',
      permissions: {
        has: vi.fn().mockReturnValue(true),
      } as any,
      user: {
        username: 'TestBot',
        displayAvatarURL: vi.fn().mockReturnValue('https://cdn.discordapp.com/avatars/bot.png'),
      } as any,
    } as unknown as Partial<GuildMember>;

    // Create mock guild
    mockGuild = {
      id: '123456789',
      name: 'Test Guild',
      channels: mockChannelsManager,
      members: {
        me: mockBotMember as GuildMember,
      } as any,
    } as unknown as Partial<Guild>;

    // Add guild to container
    (container.client.guilds.cache as Map<string, Guild>).set(mockGuild.id!, mockGuild as Guild);

    // Create route instance - skip constructor to avoid Route parent initialization issues
    route = Object.create(LoggingSetupRoute.prototype);
    // Mock the container getter
    Object.defineProperty(route, 'container', {
      get: () => container,
      configurable: true,
    });
  });

  afterEach(() => {
    (container.client.guilds.cache as Map<string, Guild>).clear();
  });

  describe('POST /guilds/:guildId/logging/setup', () => {
    it('sets up logging channels with valid types', async () => {
      const request = {
        params: { guildId: '123456789' },
        readBodyJson: vi.fn().mockResolvedValue({
          enabledTypes: ['messages', 'voice'],
          categoryName: 'Test Logs',
        }),
      } as any;

      const response = {
        statusCode: 200,
        data: null as any,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(data: any) {
          this.data = data;
          return this;
        },
      };

      await route.run(request, response as any);

      expect(response.statusCode).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        categoryId: 'category-123',
        enabledTypes: ['messages', 'voice'],
      });
      expect(mockPrismaUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { guildId: '123456789' },
        })
      );
    });

    it('requires enabledTypes array', async () => {
      const request = {
        params: { guildId: '123456789' },
        readBodyJson: vi.fn().mockResolvedValue({}),
      } as any;

      const response = {
        statusCode: 200,
        data: null as any,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(data: any) {
          this.data = data;
          return this;
        },
      };

      await route.run(request, response as any);

      expect(response.statusCode).toBe(400);
      expect(response.data).toHaveProperty('error');
      expect(response.data.details).toBeDefined();
    });

    it('rejects empty enabledTypes array', async () => {
      const request = {
        params: { guildId: '123456789' },
        readBodyJson: vi.fn().mockResolvedValue({ enabledTypes: [] }),
      } as any;

      const response = {
        statusCode: 200,
        data: null as any,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(data: any) {
          this.data = data;
          return this;
        },
      };

      await route.run(request, response as any);

      expect(response.statusCode).toBe(400);
      expect(response.data).toHaveProperty('error');
    });

    it('rejects invalid log types', async () => {
      const request = {
        params: { guildId: '123456789' },
        readBodyJson: vi.fn().mockResolvedValue({
          enabledTypes: ['INVALID_TYPE', 'ANOTHER_INVALID'],
        }),
      } as any;

      const response = {
        statusCode: 200,
        data: null as any,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(data: any) {
          this.data = data;
          return this;
        },
      };

      await route.run(request, response as any);

      expect(response.statusCode).toBe(400);
      expect(response.data.error).toContain('Invalid log types');
    });

    it('returns 404 for non-existent guild', async () => {
      const request = {
        params: { guildId: 'nonexistent' },
        readBodyJson: vi.fn().mockResolvedValue({
          enabledTypes: ['messages'],
        }),
      } as any;

      const response = {
        statusCode: 200,
        data: null as any,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(data: any) {
          this.data = data;
          return this;
        },
      };

      await route.run(request, response as any);

      expect(response.statusCode).toBe(404);
      expect(response.data.error).toContain('Guild not found');
    });

    it('returns 400 when guild ID is missing', async () => {
      const request = {
        params: {},
        readBodyJson: vi.fn().mockResolvedValue({
          enabledTypes: ['messages'],
        }),
      } as any;

      const response = {
        statusCode: 200,
        data: null as any,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(data: any) {
          this.data = data;
          return this;
        },
      };

      await route.run(request, response as any);

      expect(response.statusCode).toBe(400);
      expect(response.data.error).toContain('Guild ID is required');
    });

    it('checks bot permissions', async () => {
      // Mock bot without permissions
      mockBotMember = {
        id: 'bot-123',
        permissions: {
          has: vi.fn().mockReturnValue(false),
        } as any,
        user: {
          username: 'TestBot',
          displayAvatarURL: vi.fn().mockReturnValue('https://cdn.discordapp.com/avatars/bot.png'),
        } as any,
      } as unknown as Partial<GuildMember>;

      mockGuild.members = {
        me: mockBotMember as GuildMember,
      } as any;

      // Update guild in container cache
      (container.client.guilds.cache as Map<string, Guild>).set(mockGuild.id!, mockGuild as Guild);

      const request = {
        params: { guildId: '123456789' },
        readBodyJson: vi.fn().mockResolvedValue({
          enabledTypes: ['messages'],
        }),
      } as any;

      const response = {
        statusCode: 200,
        data: null as any,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(data: any) {
          this.data = data;
          return this;
        },
      };

      await route.run(request, response as any);

      expect(response.statusCode).toBe(403);
      expect(response.data.error).toContain('missing required permissions');
    });

    it('handles errors gracefully', async () => {
      // Make channel creation fail
      const mockChannelsManager = {
        create: vi.fn().mockRejectedValue(new Error('Channel creation failed')),
      } as unknown as GuildChannelManager;

      mockGuild.channels = mockChannelsManager;
      (container.client.guilds.cache as Map<string, Guild>).set(mockGuild.id!, mockGuild as Guild);

      const request = {
        params: { guildId: '123456789' },
        readBodyJson: vi.fn().mockResolvedValue({
          enabledTypes: ['messages'],
        }),
      } as any;

      const response = {
        statusCode: 200,
        data: null as any,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(data: any) {
          this.data = data;
          return this;
        },
      };

      await route.run(request, response as any);

      expect(response.statusCode).toBe(500);
      expect(response.data.error).toContain('Failed to set up logging system');
    });
  });
});
