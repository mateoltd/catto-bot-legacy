# Temp Voice Module

> Location: `src/modules/temp-voice/`

Temporary voice channel system with join-to-create, automatic cleanup via BullMQ, owner leave strategies, name moderation, and an interactive control panel using Components V2.

## Features

- **Join-to-Create** - Users create channels by joining a designated voice channel
- **Channel Reuse** - Rejoining JTC redirects to your existing channel instead of creating a new one
- **Auto-cleanup** - Empty channels deleted via BullMQ with configurable delay
- **Owner Leave Strategies** - TRANSFER, KEEP (with claimable notification), or DELETE
- **User Control** - Channel owners manage permissions (lock, hide, permit, deny, trust, kick)
- **Control Panel** - Components V2 interactive panel with sub-menus
- **User Preferences** - Custom defaults restored on channel creation
- **Name Moderation** - Profanity/spam detection with auto-rename or block actions
- **Anti-Abuse** - Redis cooldowns, max channels per user, spam protection
- **Redis Caching** - Config cached with automatic invalidation
- **Setup Wizard** - Interactive Discord command for first-time configuration

## Structure

```
src/modules/temp-voice/
├── services/
│   ├── operations.service.ts       # Unified channel operations (DRY)
│   ├── service-container.ts        # Lazy singleton container
│   ├── temp-channel.service.ts     # Channel CRUD
│   ├── config.service.ts           # Guild config (Redis-cached)
│   ├── config-api.service.ts       # API response mapping
│   ├── permissions.service.ts      # Discord permission overwrites
│   ├── control-panel.service.ts    # Components V2 panel
│   ├── user-preferences.service.ts # Per-user defaults
│   ├── recovery.service.ts         # Post-restart reconciliation
│   ├── temp-voice-queue.service.ts # BullMQ job queue
│   └── moderation/                 # Name moderation service
├── models/
│   ├── config.model.ts             # TempVoiceConfig interface
│   ├── temp-channel.model.ts       # Channel types
│   ├── api-response.model.ts       # API response types
│   └── name-moderation.model.ts    # Moderation types
├── constants/
│   ├── moderation-patterns.ts      # Profanity/spam patterns
│   ├── safe-names/                 # Safe name generation (i18n-ready)
│   ├── languages.ts                # Language support
│   └── patterns/                   # Detection patterns
├── utils/
│   ├── naming.util.ts              # Channel name generation
│   ├── validation.util.ts          # Config validation
│   ├── fallback.util.ts            # Category fallback logic
│   └── keyword-extraction.util.ts  # Keyword extraction
├── constants.ts                    # Enums, defaults, limits, Redis keys
└── index.ts                        # Public exports
```

## Service Container

All services are accessed through a lazy singleton container, eliminating re-instantiation on every job/interaction:

```typescript
import { getTempVoiceServices } from '#modules/temp-voice/index.js';

const { operations, config, channels, permissions, userPrefs, controlPanel } =
  getTempVoiceServices();
```

The `TempVoiceServices` interface:

```typescript
interface TempVoiceServices {
  config: TempVoiceConfigService;
  channels: TempChannelService;
  permissions: PermissionsService;
  userPrefs: UserPreferencesService;
  controlPanel: ControlPanelService;
  operations: ChannelOperationsService;
}
```

## ChannelOperationsService

Single source of truth for all temp voice channel operations. Called from slash commands, interaction handlers, and API routes.

Every method returns an `OperationResult`:

```typescript
interface OperationResult {
  ok: boolean;
  message: string;
}
```

Operations require an `OperationContext` resolved once by the caller:

```typescript
interface OperationContext {
  guild: Guild;
  guildId: string;
  channelId: string;
  tempChannel: TempVoiceChannel;
  config: TempVoiceConfig;
}
```

Available operations:

```typescript
// Channel settings
operations.toggleLock(ctx)
operations.toggleHide(ctx)
operations.rename(ctx, newName)       // Rate limited: 2 per 10 min
operations.setLimit(ctx, limit)       // 0-99
operations.setBitrate(ctx, bitrate)   // 8-384, validated against boost level
operations.setRegion(ctx, region)
operations.reset(ctx)                 // Resets all settings including trustedUserIds

// User management
operations.permit(ctx, userIds)
operations.deny(ctx, userIds)         // Kicks denied users if present
operations.toggleTrust(ctx, userIds)
operations.kick(ctx, userIds)

// Ownership
operations.transfer(ctx, newOwnerId)  // Atomic permission rebuild
operations.claim(ctx, claimerId)      // Claim abandoned channel
```

After every operation, the control panel is automatically refreshed and user preferences are saved (if `allowCustomization` is enabled).

## ConfigService

Guild configuration with Redis caching:

```typescript
const { config } = getTempVoiceServices();

// Get config (Redis-cached, falls back to Prisma)
const guildConfig = await config.get(guildId);

// Create config
await config.create(guildId, configData);

// Update config (invalidates cache)
await config.update(guildId, { defaultUserLimit: 10 });

// Delete config (invalidates cache)
await config.delete(guildId);
```

Cache key pattern: `tempvoice:config:{guildId}` with a 5-minute TTL. Redis failure degrades gracefully to direct Prisma queries.

## ControlPanelService

Interactive panel using Components V2 (`MessageFlags.IsComponentsV2`):

```typescript
const { controlPanel } = getTempVoiceServices();

// Send control panel to a voice channel
await controlPanel.sendPanel(voiceChannel, tempChannel, config);
```

The panel displays:
- **Header**: "Voice Channel Control Panel"
- **Info**: Owner, member count, bitrate, region, lock/hidden status
- **3 category buttons**: Settings, Users, Ownership

Sub-menus:
- **Settings**: Lock, Hide, Rename, Limit, Reset, Advanced Settings modal (bitrate + region)
- **Users**: Permit, Deny, Trust, Kick
- **Ownership**: Claim, Transfer

Button custom IDs use the format `tv:action:channelId` (via `encodeCustomId`), with backward compatibility for legacy `tempvoice_action_channelId` format.

## Configuration

### TempVoiceConfig

```typescript
interface TempVoiceConfig {
  guildId: string;
  enabled: boolean;

  // Join to Create
  joinToCreateChannels: string[];

  // Creation settings
  categoryId: string | null;
  fallbackCategoryId: string | null;
  namingScheme: TempVoiceNamingScheme;    // USERNAME | DISPLAYNAME | SEQUENTIAL | CUSTOM
  defaultNameTemplate: string;

  // Channel defaults
  defaultUserLimit: number;     // 0 = unlimited
  defaultBitrate: number | null;
  defaultRegion: string | null;
  defaultLocked: boolean;
  defaultHidden: boolean;

  // Cleanup
  deleteDelaySeconds: number;
  ownerLeaveStrategy: OwnerLeaveStrategy;   // TRANSFER | KEEP | DELETE

  // Anti-abuse
  cooldownSeconds: number;
  maxChannelsPerUser: number;

  // Control panel
  controlPanelEnabled: boolean;
  controlPanelOnCreate: boolean;
  allowCustomization: boolean;

  // Logging
  logChannelId: string | null;
  logWebhook: string | null;

  // Permissions
  adminRoleIds: string[];

  // Name moderation
  moderationEnabled: boolean;
  moderationAction: TempVoiceModerationAction;   // AUTO_RENAME | BLOCK
  strictMode: boolean;
  customPatterns: string[];
  allowedKeywords: string[];

  // Multi-language
  primaryLanguage: string;
  additionalLanguages: string[];
}
```

### Owner Leave Strategies

```typescript
enum OwnerLeaveStrategy {
  TRANSFER = 'TRANSFER',   // Transfer ownership to the oldest remaining member
  KEEP = 'KEEP',           // Keep original owner; notify remaining members after 10min buffer
  DELETE = 'DELETE',        // Delete channel after delay when owner leaves
}
```

### Naming Pattern Variables

| Variable | Description |
|----------|-------------|
| `{username}` | User's username |
| `{displayname}` | User's server display name |
| `{tag}` | User's tag |
| `{discriminator}` | User's discriminator (if any) |
| `{n}` | Sequential channel number |
| `{count}` | Alias for `{n}` |

### Validation Limits

| Setting | Min | Max |
|---------|-----|-----|
| `deleteDelaySeconds` | 0 | 300 |
| `cooldownSeconds` | 0 | 600 |
| `maxChannelsPerUser` | 1 | 10 |
| `defaultUserLimit` | 0 | 99 |
| `defaultBitrate` | 8 | 384 |
| `defaultNameTemplate` | - | 100 chars |

## Queue System (BullMQ)

All channel creation and deletion is managed through BullMQ jobs, not in-memory timers:

- **Channel creation**: User joins JTC → job queued → pre-flight checks (user still in voice, max channels, cooldown) → create channel → move user
- **Channel deletion**: Channel empty → job queued with delay → re-verify channel is still empty → delete
- **Claimable notification**: Owner leaves with KEEP strategy → after 10-minute buffer, notify remaining members they can claim

Redis keys:
- `tempvoice:lock:create:{userId}:{guildId}` - Creation lock
- `tempvoice:cooldown:{userId}:{guildId}` - User cooldown
- `tempvoice:config:{guildId}` - Config cache

## Listeners

### VoiceStateUpdate

`src/listeners/temp-voice/voiceStateUpdate.ts`

**On join (JTC channel):**
1. Check if user already owns a temp channel → redirect instead of creating
2. Check Redis cooldown → disconnect if active
3. Check max channels per user → disconnect if at limit
4. Queue channel creation via BullMQ
5. Cancel any pending deletion if joining an existing temp channel

**On leave (temp channel):**
1. If channel is now empty → queue deletion with configured delay
2. If owner left but members remain → apply owner leave strategy:
   - **TRANSFER**: Transfer to oldest member, rebuild permissions
   - **DELETE**: Queue deletion with delay
   - **KEEP**: Queue claimable notification after 10-minute buffer

### ChannelUpdate

`src/listeners/temp-voice/channelUpdate.ts` - Detects manual name changes and applies moderation if enabled. Uses `markAsBotRename` to prevent re-processing bot-initiated renames.

### ChannelDelete

`src/listeners/temp-voice/channelDelete.ts` - Cleans up DB records when channels are manually deleted.

### Ready

`src/listeners/temp-voice/ready.ts` - Triggers `RecoveryService` on bot startup to reconcile DB state with Discord.

### GuildAuditLog

`src/listeners/temp-voice/guildAuditLog.ts` - Tracks audit log events related to temp voice channels.

## REST API

All routes require authentication via `ApiGate` and permission checks via `gate.checkAuth()`.

### Config Routes (scope: `tempvoice.config`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/guilds/:id/temp-voice/config` | GET | Get config |
| `/guilds/:id/temp-voice/config` | POST | Create config |
| `/guilds/:id/temp-voice/config` | PATCH | Update config |
| `/guilds/:id/temp-voice/config` | DELETE | Delete config |
| `/guilds/:id/temp-voice/join-channels` | POST | Add join channel |
| `/guilds/:id/temp-voice/join-channels` | DELETE | Remove join channel |
| `/guilds/:id/temp-voice/setup` | POST | Quick setup |

### View Routes (scope: `tempvoice.view`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/guilds/:id/temp-voice/channels` | GET | List active channels |
| `/guilds/:id/temp-voice/stats` | GET | Statistics |
| `/guilds/:id/temp-voice/validate` | POST | Validate config |

### Moderation Routes (scope: `tempvoice.moderation`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/guilds/:id/temp-voice/moderation/keywords` | GET | Get keywords |
| `/guilds/:id/temp-voice/moderation/keywords` | PATCH | Update keywords |
| `/guilds/:id/temp-voice/moderation/patterns` | GET | Get patterns |
| `/guilds/:id/temp-voice/moderation/patterns` | POST | Create pattern |
| `/guilds/:id/temp-voice/moderation/patterns` | PATCH | Update pattern |
| `/guilds/:id/temp-voice/moderation/patterns` | DELETE | Delete pattern |
| `/guilds/:id/temp-voice/moderation/logs` | GET | Get moderation logs |
| `/guilds/:id/temp-voice/moderation/test` | POST | Test name against rules |

### API Response Schema

Config responses use `ownerLeaveStrategy` (enum) instead of the old `autoDeleteOwnerLeave` boolean. Channel permissions (`isLocked`, `isHidden`, `allowedUserIds`, `deniedUserIds`, `trustedUserIds`) are read directly from the `TempVoiceChannel` record.

## Commands

| Command | Description |
|---------|-------------|
| `/voice setup` | Interactive setup wizard (requires Manage Server) |
| `/voice lock` | Lock channel |
| `/voice unlock` | Unlock channel |
| `/voice hide` | Hide channel |
| `/voice show` | Show channel |
| `/voice rename <name>` | Rename channel |
| `/voice limit <0-99>` | Set user limit |
| `/voice bitrate <8-384>` | Set bitrate |
| `/voice region <region>` | Set voice region |
| `/voice reset` | Reset all settings |
| `/voice permit <user>` | Allow user to join |
| `/voice deny <user>` | Deny user |
| `/voice trust <user>` | Trust user to manage |
| `/voice untrust <user>` | Remove trust |
| `/voice kick <user>` | Kick user |
| `/voice transfer <user>` | Transfer ownership |
| `/voice claim` | Claim abandoned channel |
| `/voice panel` | Show control panel |

## Interactions

### Buttons

`src/interactions/temp-voice/buttons.ts` - Handles control panel button presses. Uses `getTempVoiceServices()` and delegates all operations to `ChannelOperationsService`. Supports sub-menu navigation (settings, users, ownership) and a refresh button.

### Modals

`src/interactions/temp-voice/modals.ts`:
- **Rename modal** - Name input with moderation check, defers reply early
- **Limit modal** - User limit (0-99)
- **Settings modal** - Bitrate and region in one modal

Custom ID format: `tv:rename_modal:channelId` (with legacy fallback).

### User Select

`src/interactions/temp-voice/user-select.ts` - Handles permit, deny, trust, kick, and transfer user selections. Uses `safeReply()` helper that tries `update()` first, then falls back to ephemeral reply.

## Related

- [Listeners](../listeners/creating-listeners.md) - Voice state handling
- [Discord Components](../core/discord-components.md) - Components V2 UI
- [REST Routes](../api/rest-routes.md) - API authentication with ApiGate
