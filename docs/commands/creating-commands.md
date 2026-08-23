# Creating Commands

This guide explains how to create new commands in the Catto bot.

## Basic Command

### 1. Create the File

Create a new file in the appropriate category directory:

```
src/commands/general/hello.ts
```

### 2. Basic Structure

```typescript
import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Command.Options>({
  name: 'hello',
  description: 'Say hello to the bot',
})
export class HelloCommand extends Command {
  // Register slash command
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description)
    );
  }

  // Handle slash command
  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    return interaction.reply('Hello!');
  }
}
```

## Command with Options

```typescript
import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Command.Options>({
  name: 'greet',
  description: 'Greet a user',
})
export class GreetCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to greet')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('Custom greeting message')
            .setRequired(false)
        )
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    const message = interaction.options.getString('message') ?? 'Hello';

    return interaction.reply(`${message}, ${user.tag}!`);
  }
}
```

## Command with Gate Validation

For commands that need permission checks:

```typescript
import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Gate } from '#lib/validation/Gate.js';
import { successContainer } from '#lib/discord/containers/index.js';
import { reply } from '#lib/discord/core/reply.js';

@ApplyOptions<Command.Options>({
  name: 'userinfo',
  description: 'Get information about a user',
})
export class UserInfoCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to look up')
            .setRequired(true)
        )
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    // Validate guild context
    const gate = Gate.from(interaction);
    if (!gate) return;

    // Check authorization
    if (!await gate.requireAuth('mod.userinfo')) return;

    const user = interaction.options.getUser('user', true);
    const member = await gate.resolveMember(user.id);

    const response = successContainer()
      .h2(`User: ${user.tag}`)
      .kv({
        'ID': user.id,
        'Created': user.createdAt.toLocaleDateString(),
        'In Server': member ? 'Yes' : 'No',
      });

    return reply(interaction, response);
  }
}
```

## Command with Deferred Reply

For long-running operations:

```typescript
import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Command.Options>({
  name: 'stats',
  description: 'Get database statistics',
})
export class StatsCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    // Defer reply for long operations
    await interaction.deferReply();

    // Do expensive work
    const stats = await this.container.prisma.guild.count();

    // Edit the deferred reply
    return interaction.editReply(`Total guilds: ${stats}`);
  }
}
```

## Command with Message Support

Support both slash and message commands:

```typescript
import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
  name: 'ping',
  aliases: ['pong'],
  description: 'Check latency',
})
export class PingCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description)
    );
  }

  // Slash command handler
  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const latency = this.container.client.ws.ping;
    return interaction.reply(`Pong! Latency: ${latency}ms`);
  }

  // Message command handler
  public override async messageRun(message: Message) {
    if (!message.channel.isSendable()) return;

    const latency = this.container.client.ws.ping;
    return message.reply(`Pong! Latency: ${latency}ms`);
  }
}
```

## Subcommands

For complex commands with multiple actions, use the subcommands plugin.

### Main Command File

```typescript
// src/commands/moderation/mod.ts
import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Subcommand.Options>({
  name: 'mod',
  description: 'Moderation commands',
  subcommands: [
    { name: 'ban', chatInputRun: 'chatInputBan' },
    { name: 'kick', chatInputRun: 'chatInputKick' },
    { name: 'warn', chatInputRun: 'chatInputWarn' },
  ],
})
export class ModCommand extends Subcommand {
  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addSubcommand((sub) =>
          sub
            .setName('ban')
            .setDescription('Ban a user')
            .addUserOption((opt) =>
              opt.setName('user').setDescription('User to ban').setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('kick')
            .setDescription('Kick a user')
            .addUserOption((opt) =>
              opt.setName('user').setDescription('User to kick').setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('warn')
            .setDescription('Warn a user')
            .addUserOption((opt) =>
              opt.setName('user').setDescription('User to warn').setRequired(true)
            )
        )
    );
  }

  public async chatInputBan(interaction: Subcommand.ChatInputCommandInteraction) {
    // Handle ban
  }

  public async chatInputKick(interaction: Subcommand.ChatInputCommandInteraction) {
    // Handle kick
  }

  public async chatInputWarn(interaction: Subcommand.ChatInputCommandInteraction) {
    // Handle warn
  }
}
```

### Separate Handler Files

For large subcommands, use separate files:

```typescript
// src/commands/moderation/_ban.ts
import type { Subcommand } from '@sapphire/plugin-subcommands';
import { Gate } from '#lib/validation/Gate.js';
import { moderationService } from '#modules/moderation/index.js';

export async function handleBan(interaction: Subcommand.ChatInputCommandInteraction) {
  const gate = Gate.from(interaction);
  if (!gate) return;

  const targetId = interaction.options.getUser('user', true).id;
  const target = await gate.requirePunitive('mod.ban', targetId);
  if (!target) return;

  await interaction.deferReply();

  const result = await moderationService.banById({
    interaction,
    guild: gate.guild,
    moderator: gate.member,
    targetId: target.id,
    reason: interaction.options.getString('reason') ?? 'No reason',
  });

  // Handle result...
}
```

## Using i18n

For translatable strings:

```typescript
import { resolveKey } from '@sapphire/plugin-i18next';

public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
  const message = await resolveKey(interaction, 'commands/ping:response', {
    latency: this.container.client.ws.ping,
  });

  return interaction.reply(message);
}
```

Translation file (`languages/en-US/commands/ping.json`):

```json
{
  "description": "Check the bot latency",
  "response": "Pong! Latency: {{latency}}ms"
}
```

## Command Options Reference

```typescript
@ApplyOptions<Command.Options>({
  name: 'mycommand',           // Command name
  aliases: ['mc', 'mycmd'],    // Message command aliases
  description: 'Description',   // Short description
  detailedDescription: '...',   // Long description for help
  preconditions: ['GuildOnly'], // Required preconditions
  cooldownDelay: 5000,          // Cooldown in ms
  cooldownLimit: 1,             // Uses before cooldown
  cooldownFilteredUsers: [],    // Users exempt from cooldown
  runIn: ['GUILD_ANY'],         // Where command can run
  enabled: true,                // Whether command is enabled
})
```

## Best Practices

1. **Use Gate for validation** - Don't manually check permissions
2. **Defer for long operations** - Avoid interaction timeouts
3. **Use FluentContainer** - Consistent message formatting
4. **Handle errors gracefully** - Don't let errors crash the bot
5. **Use services** - Business logic in modules, not commands
6. **Follow naming conventions** - See [RULES.md](../RULES.md)

## Related

- [Preconditions](preconditions.md) - Permission checks
- [Gate System](../core/gate-system.md) - Authorization system
- [Discord Components](../core/discord-components.md) - Building responses
