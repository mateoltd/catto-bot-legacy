# Coding Rules

This document defines the coding conventions and style guide for the Catto codebase.

## Formatting (Prettier)

| Rule | Value |
|------|-------|
| Print width | 100 characters |
| Tab width | 2 spaces |
| Use tabs | No (spaces only) |
| Semicolons | Required |
| Trailing commas | ES5 style |
| Quotes | Single quotes |
| Arrow parens | Always required |
| Line endings | LF (Unix) |

## TypeScript Configuration

| Setting | Value |
|---------|-------|
| Target | ES2022 |
| Module | NodeNext |
| Strict mode | Fully enabled |
| No implicit any | Enabled |
| No unused locals | Enabled |
| No unused parameters | Enabled |
| No implicit returns | Enabled |
| No unchecked indexed access | Enabled |

## Naming Conventions

### Files

| Type | Convention | Example |
|------|------------|---------|
| Commands | `kebab-case.ts` | `ping.ts`, `temp-voice.ts` |
| Listeners | `camelCase.ts` | `guildCreate.ts`, `voiceStateUpdate.ts` |
| Services | `PascalCase.ts` | `ModerationService.ts` |
| Private/internal | `_kebab-case.ts` | `_ban.ts`, `_context.ts` |
| Types/interfaces | `kebab-case.types.ts` | `moderation.types.ts` |
| Utilities | `kebab-case.ts` | `format.ts`, `validation.ts` |

### Code

| Element | Convention | Example |
|---------|------------|---------|
| Classes | PascalCase | `ModerationService`, `BotClient` |
| Interfaces | PascalCase | `ModActionResult`, `GateResult` |
| Types | PascalCase | `UserId`, `CaseNumber` |
| Functions | camelCase | `saveGuild`, `getCache` |
| Variables | camelCase | `guildId`, `targetUser` |
| Constants | UPPER_SNAKE_CASE | `AVAILABLE_LANGUAGES`, `COLORS` |
| Enum members | UPPER_SNAKE_CASE | `ModAction.BAN`, `CaseStatus.OPEN` |
| Boolean prefixes | `is`, `has`, `can`, `should` | `isValid`, `hasPermission` |

## Import Conventions

### Import Order

1. Node.js built-ins
2. External packages
3. Internal modules (path aliases)
4. Relative imports

```typescript
// 1. Built-ins (if any)
import path from 'node:path';

// 2. External packages
import { container } from '@sapphire/framework';
import { z } from 'zod';

// 3. Path aliases
import { CONFIG } from '#config.js';
import { saveGuild } from '#lib/database.js';
import { moderationService } from '#modules/moderation/index.js';

// 4. Relative imports
import { formatDuration } from './utils.js';
```

### Path Aliases

Always use path aliases for non-relative imports:

```typescript
// Good
import { saveGuild } from '#lib/database.js';
import { CONFIG } from '#config.js';

// Bad
import { saveGuild } from '../../../lib/database.js';
```

### Type Imports

Use `import type` for type-only imports:

```typescript
// Good
import type { Guild, User } from 'discord.js';
import type { ModActionResult } from '../domain/types.js';

// Bad
import { Guild, User } from 'discord.js'; // when only using as types
```

### File Extensions

Always include `.js` extensions in imports (ESM requirement):

```typescript
// Good
import { saveGuild } from '#lib/database.js';

// Bad
import { saveGuild } from '#lib/database';
```

## TypeScript Patterns

### Branded Types

Use branded types for compile-time type safety:

```typescript
// Define branded type
export type UserId = string & { readonly __brand: 'UserId' };
export const asUserId = (id: string): UserId => id as UserId;

// Use branded type
function banUser(userId: UserId, guildId: GuildId) { ... }

// Call site - prevents mixing up IDs
banUser(asUserId(user.id), asGuildId(guild.id));
```

### Discriminated Unions

Use discriminated unions for result types:

```typescript
interface Success {
  readonly ok: true;
  readonly data: SomeData;
}

interface Failure {
  readonly ok: false;
  readonly error: string;
}

type Result = Success | Failure;

// Type guard
function isSuccess(result: Result): result is Success {
  return result.ok;
}
```

### Result Objects

Prefer result objects over throwing for expected failures:

```typescript
// Good
interface ModActionResult {
  success: boolean;
  caseNumber?: CaseNumber;
  error?: string;
}

async function ban(target: User): Promise<ModActionResult> {
  try {
    await guild.members.ban(target);
    return { success: true, caseNumber: 123 };
  } catch {
    return { success: false, error: 'Failed to ban user' };
  }
}

// Bad - throwing for expected failures
async function ban(target: User): Promise<number> {
  await guild.members.ban(target); // throws on failure
  return caseNumber;
}
```

### Const Assertions

Use `as const` for literal type inference:

```typescript
const LANGUAGES = [
  { code: 'en-US', name: 'English' },
  { code: 'es-ES', name: 'Español' },
] as const;

// Type: readonly [{ readonly code: 'en-US'; ... }, ...]
```

### satisfies Operator

Use `satisfies` for type validation without widening:

```typescript
const metadata = {
  guildId: guild.id,
  action: 'ban',
} satisfies Prisma.JsonObject;
```

## Error Handling

### Service Layer

Services should return result objects:

```typescript
async function performAction(): Promise<ActionResult> {
  try {
    // ... action
    return { success: true, data };
  } catch (error) {
    container.logger.error('Action failed:', error);
    return { success: false, error: 'Action failed' };
  }
}
```

### Validation Errors

Use `ValidationError` for user input errors:

```typescript
import { ValidationError, isValidationError } from '#lib/validation/zod.js';

try {
  const data = parseOrThrow(schema, input);
} catch (error) {
  if (isValidationError(error)) {
    return reply(error.message);
  }
  throw error;
}
```

### Silent Failures

Use `.catch(() => {})` only for truly non-critical operations:

```typescript
// OK - non-critical logging
await createLog('info', 'Event').catch(() => {});

// Not OK - critical operation
await saveModerationCase(case).catch(() => {}); // Bad!
```

## Logging

### Logger Access

Use the Sapphire container logger:

```typescript
// In classes
this.container.logger.info('Message');

// Outside classes
container.logger.info('Message');

// From client
interaction.client.logger.info('Message');
```

### Log Levels

| Level | Usage |
|-------|-------|
| `info` | Normal operations, milestones |
| `warn` | Non-critical issues, deprecations |
| `error` | Errors requiring attention |
| `debug` | Development details (dev only) |

### Log Format

Include context in log messages:

```typescript
// Good
logger.error(`[ModerationService] Failed to ban ${target.id}:`, error);
logger.info(`Joined guild: ${guild.name} (${guild.id})`);

// Bad
logger.error('Error');
logger.info('Joined guild');
```

## Directory Structure

### Commands

Organize by category:

```
commands/
├── admin/
├── general/
├── moderation/
│   ├── mod.ts           # Main subcommand entry
│   ├── _ban.ts          # Subcommand handler (private)
│   └── _kick.ts
└── ...
```

### Modules

Domain-driven structure:

```
modules/
└── moderation/
    ├── services/        # Business logic
    ├── handlers/        # Command execution
    ├── discord/         # Embeds, components
    ├── domain/          # Types, interfaces
    └── index.ts         # Public exports
```

### Lib

Shared utilities:

```
lib/
├── validation/          # Permission/validation
├── discord/             # Discord utilities
│   ├── components/
│   ├── containers/
│   └── core/
├── cache/
├── database.ts
├── redis.ts
└── i18n.ts
```

## ESLint Rules

| Rule | Setting |
|------|---------|
| `@typescript-eslint/no-unused-vars` | Error (ignore `_` prefix) |
| `@typescript-eslint/no-explicit-any` | Warn |
| `@typescript-eslint/no-non-null-assertion` | Warn |
| `prefer-const` | Error |
| `no-var` | Error |

### Unused Parameters

Prefix unused parameters with `_`:

```typescript
// Good
public run(_request: Route.Request, response: Route.Response) {
  return response.json({ status: 'ok' });
}

// Bad - triggers ESLint error
public run(request: Route.Request, response: Route.Response) {
  return response.json({ status: 'ok' });
}
```

## Sapphire Patterns

### Decorators

Use `@ApplyOptions` for configuration:

```typescript
@ApplyOptions<Command.Options>({
  name: 'ping',
  description: 'Check latency',
})
export class PingCommand extends Command {
  // ...
}
```

### Listeners

One listener per file:

```typescript
import { Listener } from '@sapphire/framework';

export class GuildCreateListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: 'guildCreate',
    });
  }

  public async run(guild: Guild) {
    // Handle event
  }
}
```

### Routes

Standard route pattern:

```typescript
@ApplyOptions<Route.Options>({
  route: 'endpoint',
})
export class MyRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      methods: ['GET', 'POST'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    // Handle request
  }
}
```

## Fluent Builders

Use fluent API for Discord messages:

```typescript
import { successContainer, errorContainer } from '#lib/discord/containers/index.js';

// Success message
successContainer()
  .h2('Success')
  .text('Operation completed.')
  .field('Details', 'Some details')
  .footer('Footer text');

// Error message
errorContainer()
  .h2('Error')
  .text('Something went wrong.');
```

## Database Patterns

### Upsert Pattern

Use upsert for save operations:

```typescript
await prisma.guild.upsert({
  where: { guildId: guild.id },
  update: { name: guild.name },
  create: { guildId: guild.id, name: guild.name },
});
```

### Include Related Data

Use `include` for related data:

```typescript
const guild = await prisma.guild.findUnique({
  where: { guildId },
  include: { users: true, modCases: true },
});
```

## Summary Checklist

- [ ] Use single quotes for strings
- [ ] Use 2 spaces for indentation
- [ ] Include semicolons
- [ ] Use path aliases for imports
- [ ] Include `.js` extensions in imports
- [ ] Use `import type` for type-only imports
- [ ] Prefix unused parameters with `_`
- [ ] Use branded types for IDs
- [ ] Return result objects from services
- [ ] Use the container logger
- [ ] Follow file naming conventions
- [ ] One command/listener per file
