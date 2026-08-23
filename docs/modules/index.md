# Modules

This section documents the business logic modules.

## Overview

Modules encapsulate the core business logic for each feature. They follow a consistent structure:

```
modules/
└── [feature]/
    ├── services/       # Business logic services
    ├── handlers/       # Command execution handlers
    ├── discord/        # Embeds, components, modals
    ├── domain/         # Types and interfaces
    ├── repositories/   # Data access (optional)
    ├── utils/          # Helper functions
    └── index.ts        # Public exports
```

## Available Modules

| Module | Location | Purpose |
|--------|----------|---------|
| [Moderation](moderation.md) | `src/modules/moderation/` | Ban, kick, warn, mute, cases |
| [Evidence](evidence.md) | `src/lib/storage/`, `src/modules/moderation/services/EvidenceService.ts` | Evidence storage, B2, signing |
| [XP System](xp-system.md) | `src/modules/xp-text/`, `xp-voice/` | Leveling and leaderboards |
| [Reputation](reputation.md) | `src/modules/reputation/` | Vouching and reputation |
| [Rewards](rewards.md) | `src/modules/rewards/` | Guild reward system |
| [Temp Voice](temp-voice.md) | `src/modules/temp-voice/` | Temporary voice channels |

## Module Architecture

### Services

Services contain the core business logic:

```typescript
// src/modules/moderation/services/ModerationService.ts
export class ModerationService {
  async banById(ctx: ModerationContext): Promise<ModActionResult> {
    // Validate, execute, create case, notify
  }
}

// Singleton export
export const moderationService = new ModerationService();
```

### Handlers

Handlers bridge commands to services:

```typescript
// src/modules/moderation/handlers/ban.ts
export async function handleBan(interaction: ChatInputCommandInteraction) {
  const result = await moderationService.banById(context);
  // Format and send response
}
```

### Domain Types

Type definitions for the module:

```typescript
// src/modules/moderation/domain/types.ts
export interface ModActionResult {
  success: boolean;
  caseNumber?: CaseNumber;
  error?: string;
}
```

### Discord Components

UI components specific to the module:

```typescript
// src/modules/moderation/discord/embeds.ts
export function createCaseEmbed(modCase: ModCase): EmbedBuilder {
  // Build embed
}
```

## Using Modules

### Import Services

```typescript
import { moderationService } from '#modules/moderation/index.js';
import { reputationService } from '#modules/reputation/index.js';
```

### In Commands

```typescript
import { moderationService } from '#modules/moderation/index.js';

public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
  const result = await moderationService.warn({
    guild: interaction.guild,
    moderator: interaction.member,
    target: targetMember,
    reason: 'Spam',
  });

  if (result.success) {
    // Handle success
  } else {
    // Handle failure
  }
}
```

## Best Practices

1. **Keep services pure** - Services shouldn't touch Discord directly
2. **Use handlers for formatting** - Convert results to Discord messages
3. **Define types in domain/** - Keep types organized
4. **Export through index.ts** - Clean public API
5. **Singleton pattern** - Most services are singletons
