# Gate System

> Location: `src/lib/validation/Gate.ts`, `src/lib/validation/ApiGate.ts`, `src/lib/validation/RateLimitGate.ts`, `src/lib/validation/WeightGate.ts`

A centralized validation system for commands, API routes, and interactions — covering authorization, rate limiting, and resource guards.

## Overview

The Gate system provides:

- **Authorization** - Custom permission grants + Discord permissions
- **Hierarchy** - Role position, owner, and bot target checks
- **Target Resolution** - Safe member fetching
- **Auto-responses** - Automatic error messages on failure
- **API Authorization** - REST API session-based auth via `ApiGate`
- **Rate Limiting** - Per-action rate limits via `RateLimitGate`
- **Weight Tracking** - Upload volume limits via `WeightGate`

## Basic Usage

### Non-punitive Commands

For commands that don't target users:

```typescript
import { Gate } from '#lib/validation/Gate.js';

public async chatInputRun(interaction: ChatInputCommandInteraction) {
  const gate = Gate.from(interaction);
  if (!gate || !await gate.requireAuth('mod.history')) return;

  // Command logic
}
```

### Punitive Commands

For commands that target and moderate users:

```typescript
public async chatInputRun(interaction: ChatInputCommandInteraction) {
  const gate = Gate.from(interaction);
  if (!gate) return;

  const targetId = interaction.options.getString('user', true);
  const target = await gate.requirePunitive('mod.warn', targetId);
  if (!target) return; // Error already sent

  // Perform moderation action on target
}
```

## Factory Methods

### `Gate.from(interaction)`

Create a Gate from an interaction. Returns `null` if not in a guild.

```typescript
const gate = Gate.from(interaction);
if (!gate) {
  // Not in a guild, handle manually or return
  return;
}
```

### `Gate.require(interaction)`

Create a Gate and auto-respond if not in a guild.

```typescript
const gate = await Gate.require(interaction);
if (!gate) return; // "Server Only" error already sent
```

## Authorization

### `checkAuth(commandKey)`

Check authorization without sending errors.

```typescript
const result = await gate.checkAuth('mod.ban');

if (result.ok) {
  // Authorized
} else {
  // result.code - GateErrorCode
  // result.message - Plain text message
  // result.response - FluentContainer for Discord
}
```

### `requireAuth(commandKey)`

Check authorization and auto-respond on failure.

```typescript
if (!await gate.requireAuth('mod.ban')) return;
// Authorized, continue
```

## Hierarchy Checks

### `checkHierarchy(target)`

Validate moderation hierarchy:

```typescript
const result = gate.checkHierarchy(targetMember);

if (!result.ok) {
  // Cannot moderate target
}
```

**Rules:**
- Cannot moderate yourself
- Cannot moderate server owner
- Cannot moderate bots (unless Administrator)
- Cannot moderate users with equal/higher role
- Bot must be able to act on target

## Combined Checks

### `requirePunitive(commandKey, targetId, options?)`

Full validation for punitive actions:

```typescript
const target = await gate.requirePunitive('mod.warn', targetId, {
  requiresMember: true, // default: true
});

if (!target) return; // Error already sent

// target is a validated GuildMember
```

**Steps performed:**
1. Authorization check
2. Target resolution (fetch member)
3. Member requirement check
4. Hierarchy validation

### `requirePunitiveWithMember(commandKey, targetMember)`

Quick check when you already have the target:

```typescript
if (!await gate.requirePunitiveWithMember('mod.kick', targetMember)) return;
// All checks passed
```

## Resource-Level Authorization

For operations that need context beyond command-level auth (e.g., checking if a user can access a specific case's evidence):

### `checkResourceAuth(commandKey, context?)`

Check resource-level authorization without sending errors.

```typescript
const result = await gate.checkResourceAuth('mod.evidence.view', {
  caseId: 'clx...',
  ownerId: '123456789', // Who created the case
});

if (result.ok) {
  // Authorized for this resource
}
```

### `requireResourceAuth(commandKey, context?)`

Check resource-level auth and auto-respond on failure.

```typescript
if (!await gate.requireResourceAuth('mod.evidence.view', { caseId })) return;
// Authorized, continue
```

::: warning Current Limitation
The `resourceContext` parameter (`caseId`, `ownerId`) is accepted but **not currently enforced**. This means users with `mod.evidence.view` can access any evidence in the guild, not just evidence from cases they own or are assigned to.

Resource-level scoping (e.g., "view only your own cases") requires additional `RESOURCE`-type permission grants in the database, which is a planned future enhancement. For now, all resource checks delegate to command-level permissions only.
:::

## Error Codes

```typescript
const GateErrorCode = {
  // Authorization
  NO_PERMISSION: 'NO_PERMISSION',
  EXPLICIT_DENY: 'EXPLICIT_DENY',

  // Context
  NOT_IN_GUILD: 'NOT_IN_GUILD',
  TARGET_NOT_FOUND: 'TARGET_NOT_FOUND',
  TARGET_NOT_MEMBER: 'TARGET_NOT_MEMBER',

  // Hierarchy
  SELF_TARGET: 'SELF_TARGET',
  OWNER_TARGET: 'OWNER_TARGET',
  BOT_TARGET: 'BOT_TARGET',
  HIGHER_ROLE: 'HIGHER_ROLE',
  BOT_CANNOT_ACT: 'BOT_CANNOT_ACT',

  // Resource-level
  RATE_LIMITED: 'RATE_LIMITED',
  WEIGHT_EXCEEDED: 'WEIGHT_EXCEEDED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  INSUFFICIENT_SCOPE: 'INSUFFICIENT_SCOPE',
};
```

## Result Types

### GateResult

```typescript
type GateResult = GatePass | GateFail;

interface GatePass {
  readonly ok: true;
}

interface GateFail {
  readonly ok: false;
  readonly code: GateErrorCode;
  readonly message: string;
  readonly response: FluentContainer;
}
```

### Type Guard

```typescript
import { isFail } from '#lib/validation/Gate.js';

const result = await gate.checkAuth('mod.ban');
if (isFail(result)) {
  // result is GateFail
  console.log(result.code, result.message);
}
```

## Utilities

### `resolveMember(userId)`

Safely fetch a guild member:

```typescript
const member = await gate.resolveMember(userId);
if (!member) {
  // User not in guild
}
```

### `isAdmin`

Check if member has Administrator:

```typescript
if (gate.isAdmin) {
  // Has Administrator permission
}
```

### `isOwner`

Check if member is server owner:

```typescript
if (gate.isOwner) {
  // Is server owner
}
```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `interaction` | `GateableInteraction` | The source interaction |
| `member` | `GuildMember` | The executing member |
| `guild` | `Guild` | The guild context |

## Supported Interactions

```typescript
type GateableInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | ModalSubmitInteraction
  | ContextMenuCommandInteraction
  | StringSelectMenuInteraction;
```

## Permission Resolution

The Gate system resolves permissions in order:

1. **Custom Grants** - Check database for explicit ALLOW/DENY
2. **Discord Permissions** - Fall back to Discord permission flags

### Custom Permission Grants

Stored in database with:
- Subject (USER or ROLE)
- Resource (COMMAND, CATEGORY, or RESOURCE)
- Effect (ALLOW or DENY)

```
mod.ban → ALLOW for role:moderators
mod.* → DENY for user:123456
```

### Evidence Permission Keys

| Key | Description | Discord Fallback |
|-----|-------------|------------------|
| `mod.evidence.add` | Upload evidence, add URLs | `ModerateMembers` |
| `mod.evidence.list` | List/browse evidence | `ModerateMembers` |
| `mod.evidence.view` | View evidence content | `ModerateMembers` |
| `mod.evidence.capture` | Capture messages as evidence | `ModerateMembers` |

## Building Command Keys

```typescript
import { buildCommandKey } from '#lib/validation/Gate.js';

const key = buildCommandKey('mod', 'user', 'ban');
// 'mod.user.ban'
```

## Example: Full Command

```typescript
import { Command } from '@sapphire/framework';
import { Gate } from '#lib/validation/Gate.js';
import { moderationService } from '#modules/moderation/index.js';

export class WarnCommand extends Command {
  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const gate = Gate.from(interaction);
    if (!gate) return;

    const targetId = interaction.options.getString('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason';

    // Validate: auth + hierarchy
    const target = await gate.requirePunitive('mod.warn', targetId);
    if (!target) return;

    // Defer for long operation
    await interaction.deferReply();

    // Execute action
    const result = await moderationService.warn({
      guild: gate.guild,
      moderator: gate.member,
      target,
      reason,
    });

    // Send result
    if (result.success) {
      await interaction.editReply(`Warned ${target.user.tag}`);
    } else {
      await interaction.editReply(`Failed: ${result.error}`);
    }
  }
}
```

## ApiGate (REST API)

> Location: `src/lib/validation/ApiGate.ts`

`ApiGate` is the REST API counterpart to `Gate`. It resolves the authenticated user from HTTP requests and provides the same authorization checks, plus rate limiting and upload weight tracking.

```typescript
import { ApiGate } from '#lib/validation/ApiGate.js';
import { RateLimitGate } from '#lib/validation/RateLimitGate.js';

public async run(request: Route.Request, response: Route.Response) {
  const { guildId } = request.params;

  // 1. Create gate from request (resolves session → Discord member)
  const gate = await ApiGate.fromRequest(request, guildId);
  if (!gate) return response.status(401).json({ error: 'Unauthorized' });

  // 2. Check permission
  const auth = await gate.checkAuth('mod.evidence.view');
  if (!auth.ok) return response.status(403).json({ error: 'Forbidden', code: auth.code });

  // 3. Check rate limit
  const rateLimit = await gate.checkRateLimit('evidence.view', RateLimitGate.LIMITS['evidence.view']!);
  if (!rateLimit.ok) return response.status(429).json({ error: 'Rate Limited' });

  // 4. Execute handler
}
```

### ApiGate Properties

| Property | Type | Description |
|----------|------|-------------|
| `userId` | `string` | Authenticated Discord user ID |
| `guildId` | `string` | Guild context |
| `member` | `GuildMember` | The resolved guild member |
| `guild` | `Guild` | The guild object |
| `isAdmin` | `boolean` | Has Administrator permission |
| `isOwner` | `boolean` | Is server owner |

### RateLimitGate

> Location: `src/lib/validation/RateLimitGate.ts`

Configurable per-action rate limits backed by Redis.

| Action | Limit |
|--------|-------|
| `evidence.upload` | 10/min |
| `evidence.view` | 60/min |
| `evidence.capture` | 5/min |
| `dashboard.api` | 120/min |

### WeightGate

> Location: `src/lib/validation/WeightGate.ts`

Tracks upload volume per user per guild per session (Redis-backed).

| Limit | Value |
|-------|-------|
| Max session bytes | 2 GB |
| Session window | 1 hour |

```typescript
const weight = await gate.checkWeight('evidence.upload', sizeBytes, maxBytes);
if (!weight.ok) return response.status(413).json({ error: 'Upload limit exceeded' });
```

## Related

- [Commands](../commands/creating-commands.md) - Using Gate in commands
- [Preconditions](../commands/preconditions.md) - Command guards
- [Evidence System](../modules/evidence.md) - Evidence storage and API routes
- [REST Routes](../api/rest-routes.md) - API endpoint reference
