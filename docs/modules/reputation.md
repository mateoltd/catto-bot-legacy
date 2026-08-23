# Reputation Module

> Location: `src/modules/reputation/`

Community reputation system with vouching.

## Features

- **Vouching** - Users can vouch for each other
- **Reputation Score** - Calculated from vouches
- **Reputation Tiers** - Bronze, Silver, Gold, Platinum
- **Leaderboards** - Per-guild rankings
- **Cooldowns** - Prevent vouch spam

## Structure

```
src/modules/reputation/
├── services/
│   ├── ReputationService.ts   # Core reputation logic
│   └── VouchService.ts        # Vouch management
├── models/
│   └── reputation.models.ts   # Type definitions
└── index.ts
```

## ReputationService

Manage user reputation:

```typescript
import { reputationService } from '#modules/reputation/index.js';

// Get user reputation
const rep = await reputationService.getUserReputation(guildId, userId);
// { score: 150, tier: 'GOLD', vouchesReceived: 15, vouchesGiven: 8 }

// Get reputation leaderboard
const leaderboard = await reputationService.getLeaderboard(guildId, {
  page: 1,
  limit: 10,
});

// Get user rank
const rank = await reputationService.getUserRank(guildId, userId);
```

## VouchService

Manage vouches:

```typescript
import { vouchService } from '#modules/reputation/index.js';

// Vouch for a user
const result = await vouchService.vouch({
  guildId,
  fromUserId: voucher.id,
  toUserId: target.id,
  reason: 'Helpful community member',
});

// Check if can vouch
const canVouch = await vouchService.canVouch(guildId, fromUserId, toUserId);

// Get vouch cooldown
const cooldown = await vouchService.getCooldown(guildId, fromUserId);

// Get vouches for user
const vouches = await vouchService.getVouchesFor(guildId, userId);

// Get vouches from user
const given = await vouchService.getVouchesFrom(guildId, userId);
```

## Reputation Tiers

| Tier | Score Range | Color |
|------|-------------|-------|
| Bronze | 0-49 | Brown |
| Silver | 50-149 | Silver |
| Gold | 150-299 | Gold |
| Platinum | 300+ | Cyan |

## Vouch Rules

- **Cooldown** - Can only vouch same user every 24 hours
- **Self-vouch** - Cannot vouch for yourself
- **Minimum level** - May require minimum server level
- **Reason required** - Optional reason for vouch

## Types

### UserReputation

```typescript
interface UserReputation {
  userId: string;
  guildId: string;
  score: number;
  tier: ReputationTier;
  vouchesReceived: number;
  vouchesGiven: number;
  lastVouchReceived?: Date;
  lastVouchGiven?: Date;
}
```

### ReputationVouch

```typescript
interface ReputationVouch {
  id: number;
  guildId: string;
  fromUserId: string;
  toUserId: string;
  reason?: string;
  createdAt: Date;
}
```

### ReputationTier

```typescript
enum ReputationTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}
```

## Database Models

### UserReputation

```prisma
model UserReputation {
  id              Int      @id @default(autoincrement())
  guildId         String
  userId          String
  score           Int      @default(0)
  vouchesReceived Int      @default(0)
  vouchesGiven    Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([guildId, userId])
}
```

### ReputationVouch

```prisma
model ReputationVouch {
  id         Int      @id @default(autoincrement())
  guildId    String
  fromUserId String
  toUserId   String
  reason     String?
  createdAt  DateTime @default(now())

  @@index([guildId, toUserId])
}
```

## Commands

| Command | Description |
|---------|-------------|
| `/rep` | Quick vouch for a user |
| `/reputation view` | View user's reputation |
| `/reputation leaderboard` | View reputation rankings |
| `/reputation vouches` | View vouches for a user |

## Related

- [XP System](xp-system.md) - Similar progression system
- [Database API](../api/database.md) - Data storage
