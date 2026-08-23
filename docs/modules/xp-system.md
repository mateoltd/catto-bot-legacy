# XP System

> Location: `src/modules/xp-text/`, `src/modules/xp-voice/`

Leveling system for text messages and voice activity.

## Features

- **Text XP** - Earn XP for sending messages
- **Voice XP** - Earn XP for voice channel activity
- **Leveling** - Progress through levels
- **Leaderboards** - Per-guild rankings
- **Configurable** - Per-guild XP rates and settings
- **Role Rewards** - Auto-assign roles at levels

## Structure

### Text XP

```
src/modules/xp-text/
├── services/
│   ├── ConfigService.ts       # Guild XP settings
│   ├── LevelService.ts        # Level calculations
│   ├── AwardService.ts        # XP awarding
│   └── LeaderboardService.ts  # Rankings
├── repositories/
│   └── XPRepository.ts        # Data access
├── dtos/
│   └── xp.dto.ts              # Data objects
├── utils/
│   └── calculations.ts        # Level math
└── index.ts
```

### Voice XP

```
src/modules/xp-voice/
├── services/
│   ├── ConfigService.ts
│   ├── LevelService.ts
│   ├── AwardService.ts
│   └── LeaderboardService.ts
├── repositories/
├── dtos/
├── utils/
└── index.ts
```

## Text XP Service

### ConfigService

Manage guild XP settings:

```typescript
import { xpConfigService } from '#modules/xp-text/index.js';

// Get config
const config = await xpConfigService.getConfig(guildId);

// Update config
await xpConfigService.updateConfig(guildId, {
  enabled: true,
  xpPerMessage: 15,
  cooldownSeconds: 60,
  ignoredChannels: ['123456'],
  ignoredRoles: ['789012'],
});

// Check if enabled
const enabled = await xpConfigService.isEnabled(guildId);
```

### LevelService

Level calculations:

```typescript
import { levelService } from '#modules/xp-text/index.js';

// Get user level
const { level, xp, xpToNext } = await levelService.getUserLevel(guildId, userId);

// Calculate level from XP
const level = levelService.calculateLevel(totalXp);

// Calculate XP needed for level
const xpNeeded = levelService.xpForLevel(targetLevel);
```

### AwardService

Award XP to users:

```typescript
import { awardService } from '#modules/xp-text/index.js';

// Award XP for message
const result = await awardService.awardMessageXP(message);
// { xpAwarded: 15, newTotal: 1500, levelUp: true, newLevel: 10 }

// Award manual XP
await awardService.awardXP(guildId, userId, amount);

// Remove XP
await awardService.removeXP(guildId, userId, amount);
```

### LeaderboardService

Leaderboard operations:

```typescript
import { leaderboardService } from '#modules/xp-text/index.js';

// Get leaderboard
const leaderboard = await leaderboardService.getLeaderboard(guildId, {
  page: 1,
  limit: 10,
});

// Get user rank
const rank = await leaderboardService.getUserRank(guildId, userId);
```

## Voice XP Service

Similar structure but tracks voice activity:

```typescript
import { voiceXPService } from '#modules/xp-voice/index.js';

// Award XP for voice session
await voiceXPService.awardSessionXP(guildId, userId, sessionDuration);

// Get voice leaderboard
const leaderboard = await voiceXPService.getLeaderboard(guildId);
```

## Configuration Options

### Guild XP Config

```typescript
interface GuildXPConfig {
  enabled: boolean;
  xpPerMessage: number;      // XP per message (default: 15-25)
  cooldownSeconds: number;   // Cooldown between XP (default: 60)
  ignoredChannels: string[]; // Channels that don't give XP
  ignoredRoles: string[];    // Roles that don't give XP
  multiplier: number;        // Global XP multiplier
  levelUpChannel: string?;   // Channel for level announcements
  levelUpMessage: string?;   // Custom level up message
}
```

### Voice XP Config

```typescript
interface GuildVoiceXPConfig {
  enabled: boolean;
  xpPerMinute: number;       // XP per minute in voice
  minSessionMinutes: number; // Minimum session length
  ignoredChannels: string[];
  ignoredRoles: string[];
  afkChannelEnabled: boolean;// XP in AFK channel?
}
```

## Level Calculations

Default formula:

```typescript
// XP needed for level
function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

// Level from XP
function calculateLevel(totalXp: number): number {
  return Math.floor(Math.pow(totalXp / 100, 1/1.5));
}
```

## Listeners

### Text XP Listener

`src/listeners/xp/messageCreate.ts`:

```typescript
public async run(message: Message) {
  if (message.author.bot || !message.guild) return;

  // Check cooldown
  if (await this.isOnCooldown(message.author.id, message.guild.id)) return;

  // Award XP
  const result = await awardService.awardMessageXP(message);

  // Handle level up
  if (result.levelUp) {
    await this.sendLevelUpMessage(message, result.newLevel);
  }
}
```

### Voice XP Listener

`src/listeners/voice-xp/voiceStateUpdate.ts`:

Tracks voice session duration and awards XP when users leave.

## Database Models

### UserXP

```prisma
model UserXP {
  id        Int      @id @default(autoincrement())
  guildId   String
  odl   String
  totalXP   Int      @default(0)
  level     Int      @default(0)
  messages  Int      @default(0)
  lastXPAt  DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([guildId, userId])
}
```

### UserVoiceXP

```prisma
model UserVoiceXP {
  id            Int      @id @default(autoincrement())
  guildId       String
  userId        String
  totalXP       Int      @default(0)
  level         Int      @default(0)
  totalMinutes  Int      @default(0)
  sessions      Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([guildId, userId])
}
```

## REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/guilds/:id/xp/config` | GET | Get XP config |
| `/guilds/:id/xp/leaderboard` | GET | Get leaderboard |
| `/guilds/:id/xp/stats` | GET | Get XP stats |
| `/guilds/:id/xp/reset-user` | POST | Reset user XP |
| `/guilds/:id/xp/reset-guild` | POST | Reset all XP |
| `/guilds/:id/voice-xp/config` | GET | Get voice XP config |
| `/guilds/:id/voice-xp/leaderboard` | GET | Get voice leaderboard |

## Related

- [Database API](../api/database.md) - Data access
- [Redis API](../api/redis.md) - Cooldown caching
- [Listeners](../listeners/creating-listeners.md) - Event handling
