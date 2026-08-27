# Commands

This section documents the command system and how to create new commands.

## Overview

Commands are built using the Sapphire Framework. The bot supports:

- **Slash commands** - Discord's native command system
- **Message commands** - Traditional prefix-based commands
- **Subcommands** - Nested command structures

All chat-input commands use the shared command responder and provide an equivalent prefix entry point. As a result, the prefix `help` command reflects the complete chat-command surface. Discord context-menu commands remain application-command-only.

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
| Temp Voice | `src/commands/temp-voice/` | voice |

### Moderation Prefix Convention

Prefix help lists each moderation action once using its shortest unambiguous callable path. For
example, it displays `ban` instead of duplicating `mod ban` and `ban`, while voice monitoring uses
`mvc where` to avoid colliding with the temporary-channel `voice` command. Generic or operational
actions without a safe shortcut retain their namespace, such as `mod context` and `mod setup`.

Top-level shortcuts are reserved for unambiguous moderation concepts. This includes `!panel` and
`!mutes`; grouped actions use scoped shortcuts such as `!note`, `!evidence`, `!mute`, `!unmute`,
and `!mvc`.

### Help Pagination Convention

Help pages use category boundaries rather than a fixed number of raw lines. Categories with at
most ten entries are packed together in display order while the combined page remains within the
readability budget. A category with more than ten entries receives a dedicated page. Categories
are never split between pages unless Discord's hard 25-field or aggregate embed-text limit makes
that unavoidable.

Nested siblings are compacted by their common path automatically. For example, the moderation
actions `note add`, `note list`, and `note delete` render as one explained
`note <add | list | delete>` entry. This keeps category size and future pagination behavior stable
as new commands are added.

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

Start from the dual-transport example in [Creating Commands](creating-commands.md). It registers the slash command, adds its prefix entry point, and delegates both to one handler.

## Topics

- [Creating Commands](creating-commands.md) - Step-by-step guide
- [Preconditions](preconditions.md) - Permission checks and guards
