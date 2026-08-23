# Internal APIs

This section documents the internal APIs and helper functions available in the codebase.

## Overview

| API | Location | Purpose |
|-----|----------|---------|
| [Database](database.md) | `src/lib/database.ts` | High-level Prisma helpers |
| [Prisma Migrations](prisma-migrations.md) | `prisma/` | Safe migration workflow for ephemeral dev DBs |
| [Redis/Cache](redis.md) | `src/lib/redis.ts` | Caching and distributed operations |
| [Validation](validation.md) | `src/lib/validation/zod.ts` | Zod schemas and validation |
| [i18n](i18n.md) | `src/lib/i18n.ts` | Internationalization helpers |
| [REST Routes](rest-routes.md) | `src/routes/` | HTTP API endpoints |

## Accessing Services

All services are available through the Sapphire container:

```typescript
import { container } from '@sapphire/framework';

// Database (Prisma)
const guild = await container.prisma.guild.findUnique({ ... });

// Redis
const value = await container.redis.get('key');

// Logger
container.logger.info('Message');
```

## Import Patterns

Use path aliases for cleaner imports:

```typescript
// Database helpers
import { saveGuild, getGuild } from '#lib/database.js';

// Redis helpers
import { setCache, getCache, CacheKeys } from '#lib/redis.js';

// Validation
import { snowflakeSchema, safeParse } from '#lib/validation/zod.js';

// i18n
import { getGuildLanguage, resolveKeyForInteraction } from '#lib/i18n.js';
```

## Best Practices

1. **Use helpers over raw Prisma** - The database helpers handle common patterns
2. **Cache frequently accessed data** - Use Redis for configuration, settings
3. **Validate user input** - Always validate with Zod schemas
4. **Handle i18n** - Use translation keys for user-facing strings
