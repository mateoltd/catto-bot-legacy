# Creating Listeners

This guide explains how to create event listeners in the Catto bot.

## Basic Listener

### 1. Create the File

Create a new file in the appropriate directory:

```
src/listeners/guilds/guildMemberRemove.ts
```

### 2. Basic Structure

```typescript
import { Listener } from '@sapphire/framework';
import { Events } from '@sapphire/framework';
import type { GuildMember } from 'discord.js';

export class GuildMemberRemoveListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.GuildMemberRemove,
    });
  }

  public async run(member: GuildMember) {
    this.container.logger.info(`Member left: ${member.user.tag} from ${member.guild.name}`);
  }
}
```

## Using ApplyOptions Decorator

```typescript
import { Listener } from '@sapphire/framework';
import { Events } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Message } from 'discord.js';

@ApplyOptions<Listener.Options>({
  event: Events.MessageCreate,
})
export class MessageCreateListener extends Listener {
  public async run(message: Message) {
    if (message.author.bot) return;
    // Handle message
  }
}
```

## Once-only Listener

For events that should only fire once (like ready):

```typescript
import { Listener, Events } from '@sapphire/framework';
import type { Client } from 'discord.js';

export class ReadyListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      once: true,  // Only fires once
      event: Events.ClientReady,
    });
  }

  public async run(client: Client<true>) {
    this.container.logger.info(`Logged in as ${client.user.username}`);
  }
}
```

## Listener with Logging Service

```typescript
import { Listener, Events } from '@sapphire/framework';
import { logAction, LogType } from '#lib/logging.js';
import { Colors, type Message } from 'discord.js';

export class MessageDeleteListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.MessageDelete,
    });
  }

  public async run(message: Message) {
    // Skip bots and DMs
    if (!message.guild || message.author?.bot) return;

    // Log the deletion
    await logAction({
      guildId: message.guild.id,
      type: LogType.Messages,
      title: 'Message Deleted',
      description: message.content?.slice(0, 1000) || '*No content*',
      color: Colors.Red,
      fields: [
        { name: 'Author', value: `${message.author?.tag ?? 'Unknown'}`, inline: true },
        { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
      ],
      footer: `Message ID: ${message.id}`,
      channelId: message.channel.id, // For ignored channel checking
    });
  }
}
```

## Listener with Database Operations

```typescript
import { Listener, Events } from '@sapphire/framework';
import type { Guild } from 'discord.js';
import { saveGuild } from '#lib/database.js';

export class GuildCreateListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.GuildCreate,
    });
  }

  public async run(guild: Guild) {
    this.container.logger.info(`Joined guild: ${guild.name} (${guild.id})`);

    try {
      await saveGuild(guild);
      this.container.logger.info(`Saved guild ${guild.name} to database`);
    } catch (error) {
      this.container.logger.error(`Failed to save guild ${guild.name}:`, error);
    }
  }
}
```

## Common Discord Events

| Event | Type | Description |
|-------|------|-------------|
| `ClientReady` | `Client<true>` | Bot is ready |
| `GuildCreate` | `Guild` | Bot joined a guild |
| `GuildDelete` | `Guild` | Bot left/removed from guild |
| `GuildMemberAdd` | `GuildMember` | Member joined |
| `GuildMemberRemove` | `GuildMember` | Member left |
| `MessageCreate` | `Message` | Message sent |
| `MessageDelete` | `Message` | Message deleted |
| `MessageUpdate` | `Message, Message` | Message edited |
| `VoiceStateUpdate` | `VoiceState, VoiceState` | Voice state changed |
| `InteractionCreate` | `Interaction` | Any interaction |
| `RoleCreate` | `Role` | Role created |
| `RoleDelete` | `Role` | Role deleted |
| `ChannelCreate` | `Channel` | Channel created |
| `ChannelDelete` | `Channel` | Channel deleted |

## Sapphire Events

| Event | Description |
|-------|-------------|
| `ChatInputCommandSuccess` | Slash command executed |
| `ChatInputCommandError` | Slash command errored |
| `ChatInputCommandDenied` | Slash command denied by precondition |
| `MessageCommandSuccess` | Message command executed |

## Voice State Listener Example

```typescript
import { Listener, Events } from '@sapphire/framework';
import type { VoiceState } from 'discord.js';

export class VoiceStateUpdateListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.VoiceStateUpdate,
    });
  }

  public async run(oldState: VoiceState, newState: VoiceState) {
    // User joined a voice channel
    if (!oldState.channel && newState.channel) {
      this.container.logger.debug(
        `${newState.member?.user.tag} joined ${newState.channel.name}`
      );
    }

    // User left a voice channel
    if (oldState.channel && !newState.channel) {
      this.container.logger.debug(
        `${oldState.member?.user.tag} left ${oldState.channel.name}`
      );
    }

    // User switched channels
    if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
      this.container.logger.debug(
        `${newState.member?.user.tag} moved from ${oldState.channel.name} to ${newState.channel.name}`
      );
    }
  }
}
```

## Command Error Listener

```typescript
import { Listener, Events, type ChatInputCommandErrorPayload } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

export class ChatInputCommandErrorListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.ChatInputCommandError,
    });
  }

  public async run(error: Error, payload: ChatInputCommandErrorPayload) {
    const { command, interaction } = payload;

    this.container.logger.error(
      `[Command Error] ${interaction.user.tag} encountered an error running "${command.name}"`,
      error
    );

    const message = 'An error occurred while executing this command.';

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: message });
    } else {
      await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    }
  }
}
```

## Listener Options

```typescript
super(context, {
  event: Events.MessageCreate,  // Event to listen for
  once: false,                   // Only fire once (default: false)
  enabled: true,                 // Whether listener is active
});
```

## Best Practices

1. **Check for bots** - Skip bot messages/actions
2. **Check for guilds** - Most events need guild context
3. **Handle errors** - Don't let errors crash the bot
4. **Use logging** - Log important events
5. **Keep listeners focused** - One concern per listener
6. **Use services** - Business logic in modules, not listeners

## File Naming

- Use `camelCase` for listener files
- Name by event: `guildCreate.ts`, `messageDelete.ts`
- Use descriptive names for custom: `xpMessageHandler.ts`

## Related

- [Logging Service](../core/logging.md) - Audit logging
- [Database API](../api/database.md) - Database operations
