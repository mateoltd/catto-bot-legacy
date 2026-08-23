# Preconditions

> Location: `src/preconditions/`

Preconditions are guards that run before command execution to check permissions and context.

## Built-in Preconditions

| Precondition | Location | Purpose |
|--------------|----------|---------|
| `OwnerOnly` | `src/preconditions/OwnerOnly.ts` | Restrict to bot owners |
| `GuildOnly` | `src/preconditions/GuildOnly.ts` | Require guild context |
| `DMOnly` | `src/preconditions/DMOnly.ts` | Require DM context |
| `PermissionGate` | `src/preconditions/PermissionGate.ts` | Custom RBAC |

## Using Preconditions

### In Command Options

```typescript
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

@ApplyOptions<Command.Options>({
  name: 'admin',
  description: 'Admin-only command',
  preconditions: ['OwnerOnly'],
})
export class AdminCommand extends Command {
  // ...
}
```

### Multiple Preconditions

```typescript
@ApplyOptions<Command.Options>({
  name: 'modconfig',
  description: 'Configure moderation',
  preconditions: ['GuildOnly', 'OwnerOnly'],
})
```

## OwnerOnly

Restricts command to bot owners defined in `OWNER_IDS` config.

```typescript
// src/preconditions/OwnerOnly.ts
import { Precondition } from '@sapphire/framework';
import { CONFIG } from '#config.js';

export class OwnerOnlyPrecondition extends Precondition {
  public constructor(context: Precondition.LoaderContext, options: Precondition.Options) {
    super(context, {
      ...options,
      name: 'OwnerOnly',
    });
  }

  public override async chatInputRun(interaction: CommandInteraction) {
    return this.checkOwner(interaction.user.id);
  }

  private checkOwner(userId: string) {
    return CONFIG.OWNER_IDS.includes(userId)
      ? this.ok()
      : this.error({ message: 'This command can only be used by the bot owner.' });
  }
}
```

**Usage:**
```typescript
@ApplyOptions<Command.Options>({
  preconditions: ['OwnerOnly'],
})
```

## GuildOnly

Requires the command to be used in a guild (server).

```typescript
// src/preconditions/GuildOnly.ts
import { Precondition } from '@sapphire/framework';

export class GuildOnlyPrecondition extends Precondition {
  public override async chatInputRun(interaction: CommandInteraction) {
    return interaction.guild
      ? this.ok()
      : this.error({ message: 'This command can only be used in a server.' });
  }
}
```

**Usage:**
```typescript
@ApplyOptions<Command.Options>({
  preconditions: ['GuildOnly'],
})
```

## DMOnly

Requires the command to be used in DMs.

```typescript
@ApplyOptions<Command.Options>({
  preconditions: ['DMOnly'],
})
```

## PermissionGate

The main authorization precondition that integrates with the Gate system.

This is automatically applied to all commands via the listener in `src/listeners/00-gateContext.ts`.

## Creating Custom Preconditions

### 1. Create the File

```typescript
// src/preconditions/StaffOnly.ts
import { Precondition } from '@sapphire/framework';
import type { CommandInteraction } from 'discord.js';

export class StaffOnlyPrecondition extends Precondition {
  public constructor(context: Precondition.LoaderContext, options: Precondition.Options) {
    super(context, {
      ...options,
      name: 'StaffOnly',
    });
  }

  public override async chatInputRun(interaction: CommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      return this.error({ message: 'This command can only be used in a server.' });
    }

    const member = interaction.member as GuildMember;

    // Check for staff role
    const isStaff = member.roles.cache.some(
      (role) => role.name.toLowerCase() === 'staff'
    );

    return isStaff
      ? this.ok()
      : this.error({ message: 'This command requires the Staff role.' });
  }

  // Also implement for message commands
  public override async messageRun(message: Message) {
    // ...
  }

  // And context menus
  public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
    // ...
  }
}

// Register the precondition type
declare module '@sapphire/framework' {
  interface Preconditions {
    StaffOnly: never;
  }
}
```

### 2. Use in Commands

```typescript
@ApplyOptions<Command.Options>({
  name: 'staffcommand',
  preconditions: ['GuildOnly', 'StaffOnly'],
})
```

## Precondition Results

### Success

```typescript
return this.ok();
```

### Failure

```typescript
return this.error({
  message: 'Error message shown to user',
  identifier: 'UniqueErrorIdentifier', // Optional
  context: { extra: 'data' }, // Optional
});
```

## Handler Methods

Implement these methods based on command types:

| Method | Command Type |
|--------|--------------|
| `chatInputRun` | Slash commands |
| `messageRun` | Message commands |
| `contextMenuRun` | Context menu commands |

```typescript
export class MyPrecondition extends Precondition {
  public override async chatInputRun(interaction: CommandInteraction) {
    // Slash command check
  }

  public override async messageRun(message: Message) {
    // Message command check
  }

  public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
    // Context menu check
  }
}
```

## Conditional Preconditions

Preconditions that vary based on conditions:

```typescript
export class PremiumOnlyPrecondition extends Precondition {
  public override async chatInputRun(interaction: CommandInteraction) {
    if (!interaction.guild) {
      return this.error({ message: 'Guild only' });
    }

    // Check if guild has premium
    const guild = await this.container.prisma.guild.findUnique({
      where: { guildId: interaction.guild.id },
    });

    if (guild?.isPremium) {
      return this.ok();
    }

    return this.error({
      message: 'This command requires a premium subscription.',
    });
  }
}
```

## Combining with Gate

For most permission checks, use the Gate system instead of custom preconditions:

```typescript
// In command - preferred approach
const gate = Gate.from(interaction);
if (!gate || !await gate.requireAuth('mod.ban')) return;
```

Use preconditions for:
- Context requirements (guild/DM)
- Owner-only restrictions
- Feature flags (premium)
- Simple role checks

Use Gate for:
- Command-specific permissions
- Custom permission grants
- Hierarchy validation
- Target validation

## Error Handling

Precondition errors are automatically handled by Sapphire:

```typescript
// src/listeners/commands/chatInputCommandDenied.ts
import { Listener } from '@sapphire/framework';

export class ChatInputCommandDeniedListener extends Listener {
  public run(error: UserError, payload: ChatInputCommandDeniedPayload) {
    return payload.interaction.reply({
      content: error.message,
      ephemeral: true,
    });
  }
}
```

## Related

- [Creating Commands](creating-commands.md) - Command creation guide
- [Gate System](../core/gate-system.md) - Advanced authorization
