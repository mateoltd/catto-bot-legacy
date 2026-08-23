# Commands

This section documents the command system and how to create new commands.

## Overview

Commands are built using the Sapphire Framework. The bot supports:

- **Slash commands** - Discord's native command system
- **Message commands** - Traditional prefix-based commands
- **Subcommands** - Nested command structures

## Command Categories

| Category | Location | Commands |
|----------|----------|----------|
| General | `src/commands/general/` | ping, info, help, language, dbstats, redis |
| Admin | `src/commands/admin/` | permission |
| Moderation | `src/commands/moderation/` | mod (with 20+ subcommands), plus prefix aliases |
| Fun | `src/commands/fun/` | fun (bonk, superbonk) |
| Leveling | `src/commands/leveling/` | rank, leaderboard |
| Reputation | `src/commands/reputation/` | rep, reputation |
| Rewards | `src/commands/rewards/` | rewards |
| Temp Voice | `src/commands/temp-voice/` | tempvoice |

## Command Structure

```
src/commands/
├── admin/
│   └── permission.ts
├── fun/
│   └── fun.ts              # /fun bonk, /fun superbonk
├── general/
│   ├── ping.ts
│   ├── info.ts
│   ├── help.ts
│   └── language.ts
├── leveling/
│   ├── rank.ts             # /rank - XP rank card
│   └── leaderboard.ts      # /leaderboard - XP leaderboard
├── moderation/
│   ├── mod.ts              # Main subcommand entry (/mod)
│   ├── _ban.ts             # Shared handler (slash + prefix)
│   ├── _kick.ts
│   ├── ...
│   └── aliases/
│       ├── _registry.ts    # Data-driven registry for simple aliases
│       ├── _shared.ts      # Shared prefix alias utilities
│       ├── mute.ts         # Complex aliases (subcommand routing)
│       ├── unmute.ts
│       ├── evidence.ts
│       ├── note.ts
│       └── voice.ts
└── ...
```

## Fun Commands

### `/fun bonk`

Bonk another user with a bat meme image. Generates a custom PNG with the bonker's and target's avatars composited onto an animal-themed template.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `target` | User | Yes | The user to bonk |
| `style` | String | No | Meme style: Doge (default), Cat, Lions, Rabbit, Capybara |
| `effects` | Boolean | No | Add random intensity effects (stars, speed lines, damage numbers) |

When effects are enabled, intensity is rolled randomly with a weighted distribution (25% gentle, 30% normal, 25% mega, 15% critical, 5% ultra). Non-self-bonks include a "Bonk Back" revenge button that only the victim can use.

Bonks are tracked per-user per-guild in Redis.

### `/fun superbonk` (owner-only)

The ultimate bonk. Generates a "fatality" meme image and executes a real moderation action on the target.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `target` | User | Yes | The user to superbonk |
| `type` | String | No | Punishment: Ban (default) or Timeout (1m) |

The target receives a DM with the bonk image before the punishment is applied. The command runs `canModerate` checks before acting and creates a moderation case through the standard mod system.

## Quick Start

See [Creating Commands](creating-commands.md) for detailed instructions.

```typescript
import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Command.Options>({
  name: 'hello',
  description: 'Say hello',
})
export class HelloCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    return interaction.reply('Hello!');
  }
}
```

## Topics

- [Creating Commands](creating-commands.md) - Step-by-step guide
- [Preconditions](preconditions.md) - Permission checks and guards
