import { SapphireClient, LogLevel, container, RegisterBehavior } from '@sapphire/framework';
import { GatewayIntentBits, Partials, type ClientOptions } from 'discord.js';
import { OAuth2Scopes } from 'discord-api-types/v10';
import { CONFIG } from '#config.js';
import { join } from 'node:path';
import type { InternationalizationContext } from '@sapphire/plugin-i18next';
import type { Server } from '@sapphire/plugin-api';
import { getGuildLanguage } from '#lib/i18n.js';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Redis } from 'ioredis'; // recommended by IORedis docs starting from v5 for module interop
import { getRootData } from '@sapphire/pieces';
import { registerSimpleAliases } from '#commands/moderation/aliases/_registry.js';

// Augment container with Prisma, Redis, and API Server
declare module '@sapphire/framework' {
  interface Container {
    prisma: PrismaClient;
    redis: Redis;
    server: Server;
  }
}

export class BotClient extends SapphireClient {
  private rootData = getRootData();
  public constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        // GUILD_EMBEDDED_ACTIVITIES (1 << 17) - for Discord Activities in voice channels
        // This is an undocumented intent that enables EMBEDDED_ACTIVITY_UPDATE_V2 events
        1 << 17,
      ],
      partials: [Partials.Channel, Partials.Message],
      loadDefaultErrorListeners: true,
      loadMessageCommandListeners: true,
      logger: {
        level: CONFIG.NODE_ENV === 'development' ? LogLevel.Debug : LogLevel.Info,
      },
      defaultPrefix: CONFIG.DEFAULT_PREFIX,
      defaultCooldown: {
        delay: 3000,
        limit: 1,
        filteredUsers: CONFIG.OWNER_IDS,
      },
      hmr: {
        enabled: CONFIG.NODE_ENV === 'development',
      },
      applicationCommandRegistries: {
        registerCommandIdOnly: false,
        behaviorWhenNotIdentical: RegisterBehavior.Overwrite,
      },
      api: {
        auth: {
          id: CONFIG.CLIENT_ID,
          secret: CONFIG.CLIENT_SECRET,
          cookie: 'SAPPHIRE_AUTH',
          redirect: CONFIG.API_REDIRECT,
          scopes: [OAuth2Scopes.Identify, OAuth2Scopes.Guilds],
        },
        prefix: CONFIG.API_PREFIX,
        origin: CONFIG.API_ORIGIN === '*' ? CONFIG.DASHBOARD_URL : CONFIG.API_ORIGIN,
        listenOptions: {
          port: CONFIG.API_PORT,
        },
        automaticallyConnect: true,
      },
      i18n: {
        // Use getRootData().root for reliable path resolution regardless of cwd
        // rootData.root points to dist/, so we go up one level to find languages/
        defaultLanguageDirectory: join(getRootData().root, '..', 'languages'),
        defaultMissingKey: 'Missing translation: {{key}}',
        defaultNS: 'common',
        i18next: (_: string[], languages: string[]) => ({
          supportedLngs: languages,
          preload: languages,
          returnObjects: true,
          returnEmptyString: false,
          returnNull: false,
          load: 'all',
          lng: 'en-US',
          fallbackLng: 'en-US',
          defaultNS: 'common',
          interpolation: {
            escapeValue: false,
          },
        }),
        fetchLanguage: async (context: InternationalizationContext) => {
          // Get language from database for guilds
          if (context.guild) {
            return await getGuildLanguage(context.guild.id);
          }
          return 'en-US';
        },
      },
    } as ClientOptions);

    // Initialize Prisma Client with pg adapter
    const adapter = new PrismaPg({
      connectionString: CONFIG.DATABASE_URL,
    });
    container.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      errorFormat: 'pretty',
    });

    // Initialize Redis Client in container
    container.redis = new Redis({
      host: CONFIG.REDIS_HOST,
      port: CONFIG.REDIS_PORT,
      password: CONFIG.REDIS_PASSWORD,
      db: CONFIG.REDIS_DB,
      retryStrategy: (times: number) => {
        // Stop retrying if we're in a disconnected/end state (during shutdown)
        if (
          container.redis &&
          (container.redis.status === 'end' || container.redis.status === 'close')
        ) {
          return null;
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
    });

    // Connect to Redis
    container.redis.connect().catch((error) => {
      console.error('Failed to connect to Redis:', error);
    });

    // OAuth redirect URI validation reminder
    // TODO: This should be part of #2 (safety checks on startup)
    if (CONFIG.API_REDIRECT) {
      console.log(
        `[OAuth] API_REDIRECT is set to: ${CONFIG.API_REDIRECT}\n` +
          '        Ensure this exactly matches the redirect URI registered in Discord Developer Portal.'
      );
    } else {
      console.warn(
        '[OAuth] WARNING: API_REDIRECT is not set. OAuth login will fail.\n' +
          '        Set API_REDIRECT to match the redirect URI registered in Discord Developer Portal.'
      );
    }

    // Redis event listeners
    container.redis.on('connect', () => {
      console.log('Connected to Redis');
    });

    container.redis.on('error', (error) => {
      // Only log errors if we're not shutting down
      if (container.redis.status !== 'end' && container.redis.status !== 'close') {
        console.error('Redis error:', error);
      }
    });

    container.redis.on('reconnecting', () => {
      // Only log reconnection attempts if we're not shutting down
      if (container.redis.status !== 'end' && container.redis.status !== 'close') {
        console.log('Reconnecting to Redis...');
      }
    });
    this.stores.get('interaction-handlers').registerPath(join(this.rootData.root, 'interactions'));
    registerSimpleAliases(this.stores);
  }

  public override async login(token?: string): Promise<string> {
    return super.login(token);
  }

  public override async destroy(): Promise<void> {
    await container.prisma.$disconnect();
    await container.redis.quit();
    return super.destroy();
  }
}
