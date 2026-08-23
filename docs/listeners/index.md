# Listeners

This section documents the event listener system.

## Overview

Listeners handle Discord events and internal framework events. They're built using Sapphire's listener system.

## Listener Categories

| Category | Location | Purpose |
|----------|----------|---------|
| Commands | `src/listeners/commands/` | Command execution events |
| Guilds | `src/listeners/guilds/` | Guild join/leave events |
| Logs | `src/listeners/logs/` | Audit log events (30+ types) |
| Temp Voice | `src/listeners/temp-voice/` | Voice channel events |
| Voice XP | `src/listeners/voice-xp/` | Voice activity tracking |
| XP | `src/listeners/xp/` | Message XP tracking |
| Special | `src/listeners/` | Ready, gate context, etc. |

## Directory Structure

```
src/listeners/
├── commands/
│   ├── chatInputCommandSuccess.ts
│   ├── chatInputCommandError.ts
│   ├── chatInputCommandDenied.ts
│   └── ...
├── guilds/
│   ├── guildCreate.ts
│   ├── guildDelete.ts
│   ├── guildMemberAdd.ts
│   └── ...
├── logs/
│   ├── messageDelete.ts
│   ├── messageUpdate.ts
│   ├── roleCreate.ts
│   └── ... (30+ event types)
├── temp-voice/
│   ├── voiceStateUpdate.ts
│   └── channelDelete.ts
├── voice-xp/
│   └── voiceStateUpdate.ts
├── xp/
│   └── messageCreate.ts
├── 00-gateContext.ts
├── ready.ts
└── embeddedActivityUpdate.ts
```

## Quick Start

See [Creating Listeners](creating-listeners.md) for detailed instructions.

```typescript
import { Listener } from '@sapphire/framework';
import { Events } from '@sapphire/framework';
import type { Message } from 'discord.js';

export class MyListener extends Listener {
  public constructor(context: Listener.LoaderContext) {
    super(context, {
      event: Events.MessageCreate,
    });
  }

  public async run(message: Message) {
    if (message.author.bot) return;
    // Handle message
  }
}
```

## Key Listeners

### Ready Listener

`src/listeners/ready.ts` - Runs once when bot starts:
- Logs startup info
- Syncs guilds to database
- Initializes schedulers (tempban, mute)
- Sets up graceful shutdown

### Gate Context Listener

`src/listeners/00-gateContext.ts` - Pre-initializes Gate for interactions:
- Named with `00-` to run first
- Sets up Gate context in WeakMap

## Topics

- [Creating Listeners](creating-listeners.md) - Step-by-step guide
