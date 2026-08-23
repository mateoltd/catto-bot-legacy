# Rewards Module

> Location: `src/modules/rewards/`

Guild reward distribution system.

## Features

- **Custom Rewards** - Create guild-specific rewards
- **Templates** - Predefined reward templates
- **User Tracking** - Track distributed rewards
- **Integration** - Extensible reward system
- **Statistics** - Reward distribution analytics

## Structure

```
src/modules/rewards/
├── services/
│   └── RewardService.ts       # Core reward logic
├── integrations/
│   └── RewardIntegration.ts   # External integrations
└── index.ts
```

## RewardService

Manage rewards:

```typescript
import { rewardService } from '#modules/rewards/index.js';

// Create reward
const reward = await rewardService.createReward({
  guildId,
  name: 'VIP Access',
  description: '1 month VIP role',
  type: 'ROLE',
  value: roleId,
  cost: 1000, // XP cost or other currency
});

// Get rewards
const rewards = await rewardService.getRewards(guildId);

// Get reward by ID
const reward = await rewardService.getReward(rewardId);

// Award reward to user
await rewardService.awardReward(guildId, userId, rewardId);

// Get user rewards
const userRewards = await rewardService.getUserRewards(guildId, userId);

// Delete reward
await rewardService.deleteReward(rewardId);
```

## Reward Templates

Predefined reward templates:

```typescript
import { templateService } from '#modules/rewards/index.js';

// Get templates
const templates = await templateService.getTemplates(guildId);

// Get template by name
const template = await templateService.getTemplate(guildId, 'vip_role');

// Create from template
const reward = await rewardService.createFromTemplate(guildId, templateName, options);
```

## Types

### Reward

```typescript
interface Reward {
  id: number;
  guildId: string;
  name: string;
  description?: string;
  type: RewardType;
  value: string;       // Role ID, item code, etc.
  cost: number;        // XP cost
  stock?: number;      // Limited quantity
  expiresAt?: Date;    // Expiration date
  enabled: boolean;
  createdAt: Date;
}
```

### RewardType

```typescript
enum RewardType {
  ROLE = 'ROLE',       // Discord role
  CUSTOM = 'CUSTOM',   // Custom reward
  ITEM = 'ITEM',       // Virtual item
}
```

### UserReward

```typescript
interface UserReward {
  id: number;
  guildId: string;
  userId: string;
  rewardId: number;
  awardedAt: Date;
  awardedBy?: string;  // Who awarded (for manual)
  expiresAt?: Date;
}
```

### RewardTemplate

```typescript
interface RewardTemplate {
  name: string;
  description: string;
  type: RewardType;
  defaultCost: number;
}
```

## Database Models

### Reward

```prisma
model Reward {
  id          Int        @id @default(autoincrement())
  guildId     String
  name        String
  description String?
  type        RewardType
  value       String
  cost        Int
  stock       Int?
  expiresAt   DateTime?
  enabled     Boolean    @default(true)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  userRewards UserReward[]

  @@index([guildId])
}
```

### UserReward

```prisma
model UserReward {
  id        Int      @id @default(autoincrement())
  guildId   String
  userId    String
  rewardId  Int
  awardedAt DateTime @default(now())
  awardedBy String?
  expiresAt DateTime?

  reward    Reward   @relation(fields: [rewardId], references: [id])

  @@index([guildId, userId])
}
```

## REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/guilds/:id/rewards` | GET | List rewards |
| `/guilds/:id/rewards` | POST | Create reward |
| `/guilds/:id/rewards/:rewardId` | GET | Get reward |
| `/guilds/:id/rewards/:rewardId` | DELETE | Delete reward |
| `/guilds/:id/rewards/stats` | GET | Reward statistics |
| `/guilds/:id/rewards/users/:userId` | GET | User's rewards |
| `/guilds/:id/rewards/templates` | GET | List templates |

## Commands

| Command | Description |
|---------|-------------|
| `/rewards list` | View available rewards |
| `/rewards claim` | Claim a reward |
| `/rewards create` | Create a reward (admin) |
| `/rewards delete` | Delete a reward (admin) |
| `/rewards give` | Give reward to user (admin) |

## Related

- [XP System](xp-system.md) - XP for reward costs
- [Database API](../api/database.md) - Data storage
