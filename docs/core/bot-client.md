# BotClient

> Location: `src/structures/BotClient.ts`

The main client class that extends Sapphire's `SapphireClient` with Prisma and Redis integration.

## Overview

`BotClient` is the entry point for the bot. It:

- Configures Discord.js intents and partials
- Initializes Prisma with PostgreSQL adapter
- Initializes Redis connection
- Configures Sapphire plugins (API, i18n, Logger)
- Sets up hot module reload for development

## Container Augmentation

The container is augmented with custom services:

```typescript
declare module '@sapphire/framework' {
  interface Container {
    prisma: PrismaClient;
    redis: Redis;
    server: Server;
  }
}
```

## Configuration

### Intents

```typescript
intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.MessageContent,
  1 << 17, // GUILD_EMBEDDED_ACTIVITIES (undocumented)
]
```

### Partials

```typescript
partials: [Partials.Channel, Partials.Message]
```

### Cooldowns

```typescript
defaultCooldown: {
  delay: 3000,     // 3 seconds
  limit: 1,        // 1 use
  filteredUsers: CONFIG.OWNER_IDS, // Owners bypass
}
```

### Hot Module Reload

Enabled in development for faster iteration:

```typescript
hmr: {
  enabled: CONFIG.NODE_ENV === 'development',
}
```

### Command Registration

```typescript
applicationCommandRegistries: {
  registerCommandIdOnly: false,
  behaviorWhenNotIdentical: RegisterBehavior.Overwrite,
}
```

## Prisma Initialization

Uses the PostgreSQL adapter:

```typescript
const adapter = new PrismaPg({
  connectionString: CONFIG.DATABASE_URL,
});

container.prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
  errorFormat: 'pretty',
});
```

## Redis Initialization

```typescript
container.redis = new Redis({
  host: CONFIG.REDIS_HOST,
  port: CONFIG.REDIS_PORT,
  password: CONFIG.REDIS_PASSWORD,
  db: CONFIG.REDIS_DB,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true,
});
```

## API Configuration

OAuth2-enabled REST API:

```typescript
api: {
  auth: {
    id: CONFIG.CLIENT_ID,
    secret: CONFIG.CLIENT_SECRET,
    cookie: 'SAPPHIRE_AUTH',
    redirect: CONFIG.API_REDIRECT,
    scopes: [OAuth2Scopes.Identify, OAuth2Scopes.Guilds],
  },
  prefix: CONFIG.API_PREFIX,
  origin: CONFIG.API_ORIGIN,
  listenOptions: {
    port: CONFIG.API_PORT,
  },
  automaticallyConnect: true,
}
```

## i18n Configuration

Guild-specific language support:

```typescript
i18n: {
  defaultLanguageDirectory: join(getRootData().root, '..', 'languages'),
  defaultMissingKey: 'Missing translation: {{key}}',
  defaultNS: 'common',
  i18next: (_: string[], languages: string[]) => ({
    supportedLngs: languages,
    lng: 'en-US',
    fallbackLng: 'en-US',
  }),
  fetchLanguage: async (context) => {
    if (context.guild) {
      return await getGuildLanguage(context.guild.id);
    }
    return 'en-US';
  },
}
```

## Lifecycle Methods

### `login(token?)`

Calls parent login:

```typescript
public override async login(token?: string): Promise<string> {
  return super.login(token);
}
```

### `destroy()`

Cleans up connections:

```typescript
public override async destroy(): Promise<void> {
  await container.prisma.$disconnect();
  await container.redis.quit();
  return super.destroy();
}
```

## Usage

```typescript
// src/index.ts
import 'reflect-metadata';
import './setup.js';
import { BotClient } from '#structures/BotClient.js';
import { CONFIG } from '#config.js';

const client = new BotClient();

client.login(CONFIG.DISCORD_TOKEN).catch((error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Bot token |
| `CLIENT_ID` | OAuth2 client ID |
| `CLIENT_SECRET` | OAuth2 client secret |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_HOST` | Redis host |
| `REDIS_PORT` | Redis port |
| `REDIS_PASSWORD` | Redis password (optional) |
| `REDIS_DB` | Redis database number |
| `API_PORT` | HTTP API port |
| `API_PREFIX` | API route prefix |
| `API_ORIGIN` | OAuth2 origin |
| `API_REDIRECT` | OAuth2 redirect URL |
| `NODE_ENV` | Environment mode |
| `DEFAULT_PREFIX` | Message command prefix |
| `OWNER_IDS` | Bot owner IDs (comma-separated) |

## Related

- [Database API](../api/database.md) - Database helpers
- [Redis API](../api/redis.md) - Redis helpers
- [REST Routes](../api/rest-routes.md) - API endpoints
