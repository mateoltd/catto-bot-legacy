# Core Systems

This section documents the core systems that power the bot.

## Overview

| System | Location | Purpose |
|--------|----------|---------|
| [BotClient](bot-client.md) | `src/structures/BotClient.ts` | Main client with Prisma/Redis |
| [Gate System](gate-system.md) | `src/lib/validation/Gate.ts` | Authorization, rate limits, resource guards |
| [Discord Components](discord-components.md) | `src/lib/discord/` | UI components and builders |
| [Logging](logging.md) | `src/lib/logging.ts` | Audit logging with BullMQ |

## Architecture

```
BotClient
├── Sapphire Framework
│   ├── Commands
│   ├── Listeners
│   └── Routes (API)
├── Prisma Client
│   └── PostgreSQL
├── Redis Client
│   ├── Caching
│   └── BullMQ Jobs
└── Plugins
    ├── API (OAuth2)
    ├── i18n
    └── Logger
```

## Container Access

All core services are available through the Sapphire container:

```typescript
import { container } from '@sapphire/framework';

// Database
await container.prisma.guild.findUnique({ ... });

// Redis
await container.redis.get('key');

// Logger
container.logger.info('Message');

// Client
const guilds = container.client.guilds.cache.size;
```

## Common Patterns

### Initialization

Services are initialized in `BotClient.constructor()`:

```typescript
// Prisma
container.prisma = new PrismaClient({ adapter });

// Redis
container.redis = new Redis({ host, port, password });
```

### Cleanup

Services are properly cleaned up in `BotClient.destroy()`:

```typescript
await container.prisma.$disconnect();
await container.redis.quit();
```

### Error Handling

Use the container logger for consistent error handling:

```typescript
try {
  await operation();
} catch (error) {
  container.logger.error('Operation failed:', error);
}
```
