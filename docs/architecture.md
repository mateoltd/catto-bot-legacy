# Architecture

This document describes the system architecture of Catto v2.x and how components interact.

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Sapphire v5.5 | Discord.js abstraction with decorators |
| Language | TypeScript 5.7 | Type-safe JavaScript |
| Database | PostgreSQL | Persistent data storage |
| ORM | Prisma v7 | Database operations and migrations |
| Cache | Redis | Caching, rate limiting, pub/sub |
| Queue | BullMQ | Background job processing |
| Object Storage | Backblaze B2 (S3-compatible) | Evidence file storage |
| Dashboard | Next.js 15 | Moderator web UI |
| Validation | Zod | Schema validation |
| i18n | i18next | Internationalization |
| Microservices | Rust (axum) | High-performance image processing and generation |

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Discord Gateway                          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BotClient                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Prisma    │  │    Redis    │  │     Sapphire Plugins    │  │
│  │   Client    │  │   Client    │  │  (API, i18n, Logger)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Commands    │    │   Listeners   │    │    Routes     │
│  (31 files)   │    │  (52 files)   │    │  (REST API)   │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Modules                                │
│  ┌───────────┐ ┌─────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐  │
│  │Moderation │ │   XP    │ │Reputation│ │Rewards │ │TempVoice│  │
│  │  Service  │ │ Service │ │ Service  │ │Service │ │ Service │  │
│  └───────────┘ └─────────┘ └──────────┘ └────────┘ └─────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   PostgreSQL  │    │     Redis     │    │    BullMQ     │
│   (Prisma)    │    │   (Cache)     │    │   (Jobs)      │
└───────────────┘    └───────────────┘    └───────────────┘
        │                                         │
        │                                         │
        ▼                                         ▼
┌───────────────┐                        ┌───────────────┐
│  Backblaze B2 │                        │   Dashboard   │
│  (Evidence)   │                        │  (Next.js)    │
└───────────────┘                        └───────────────┘
        ▲
        │
┌───────────────┐    ┌───────────────┐
│   Watermark   │    │  Image Gen    │
│   (Rust)      │    │   (Rust)      │
└───────────────┘    └───────────────┘
```

## Request Flow

### Discord Interaction Flow

```
1. User sends /command in Discord
                │
                ▼
2. InteractionCreate event received
                │
                ▼
3. gateContext listener initializes Gate
                │
                ▼
4. PermissionGate precondition checks auth
                │
                ▼
5. Command handler executes
                │
                ▼
6. Service layer processes business logic
                │
                ▼
7. Database/Cache operations
                │
                ▼
8. Response sent to Discord
```

### REST API Flow

```
1. HTTP request to /api/...
   (from dashboard or external client)
                │
                ▼
2. Sapphire API middleware
                │
                ▼
3. ApiGate resolves session → Discord member
                │
                ▼
4. Permission + rate limit checks
                │
                ▼
5. Route handler executes
                │
                ▼
6. Service layer (if needed)
                │
                ▼
7. JSON response returned
```

### Dashboard Flow

```
1. User opens dashboard (Next.js on port 3000)
                │
                ▼
2. Login → bot /api/oauth/login → Discord OAuth2 → bot /api/oauth/callback
                │
                ▼
3. Bot redirects to dashboard /api/auth/callback with token
                │
                ▼
4. Dashboard sets DASHBOARD_AUTH cookie
                │
                ▼
5. Dashboard calls bot REST API with cookie for all data
```

## Directory Structure

### `/src/commands/`

Commands are organized by category:

```
commands/
├── admin/          # Admin-only commands
│   └── permission.ts
├── general/        # Utility commands
│   ├── ping.ts
│   ├── info.ts
│   ├── help.ts
│   └── language.ts
├── moderation/     # Moderation commands
│   ├── mod.ts           # Main subcommand entry (/mod)
│   ├── _ban.ts          # Shared handlers (slash + prefix)
│   ├── _kick.ts
│   ├── _evidenceAdd.ts  # Evidence subcommands
│   ├── _evidenceList.ts
│   ├── captureEvidence.ts  # Context menu command
│   ├── aliases/         # Prefix command aliases (!ban, !kick, etc.)
│   │   ├── _registry.ts # Data-driven registry for simple aliases
│   │   └── _shared.ts   # Shared prefix utilities
│   └── ...
├── reputation/     # Reputation commands
├── rewards/        # Reward commands
└── temp-voice/     # Voice channel commands
```

### `/src/listeners/`

Event handlers for Discord events:

```
listeners/
├── commands/       # Command execution events
├── guilds/         # Guild events (join, leave, update)
├── logs/           # Audit log events (30+ types)
├── temp-voice/     # Voice state events
├── voice-xp/       # Voice XP tracking
├── xp/             # Text XP tracking
└── ready.ts        # Bot ready event
```

### `/src/modules/`

Business logic organized by feature:

```
modules/
├── moderation/
│   ├── services/   # ModerationService, MuteService, EvidenceService, etc.
│   ├── handlers/   # Command execution handlers
│   ├── discord/    # Embeds, components, modals
│   └── domain/     # Types and domain logic (incl. evidence-types.ts)
├── xp-text/
├── xp-voice/
├── reputation/
├── rewards/
└── temp-voice/
```

### `/src/lib/`

Shared utilities and helpers:

```
lib/
├── validation/     # Gate permission system
│   ├── Gate.ts         # Discord interaction gate
│   ├── ApiGate.ts      # REST API gate
│   ├── RateLimitGate.ts# Rate limiting
│   ├── WeightGate.ts   # Upload weight tracking
│   └── ...
├── storage/        # Object storage (Backblaze B2)
│   ├── StorageService.ts  # S3-compatible client
│   └── SigningService.ts  # HMAC-SHA256 integrity
├── discord/        # Discord component utilities
│   ├── components/ # Buttons, modals, selects
│   ├── containers/ # Fluent message builders
│   ├── core/       # CustomId, format, reply
│   └── design/     # Colors, emojis
├── cache/          # TypedCache wrapper
├── rateLimit/      # Rate limiting utilities
├── database.ts     # High-level DB helpers
├── redis.ts        # Redis helpers
├── i18n.ts         # Localization helpers
└── types.ts        # Shared types
```

## Key Patterns

### Service Layer Pattern

Business logic is encapsulated in service classes:

```typescript
// src/modules/moderation/services/ModerationService.ts
export class ModerationService {
  async banById(ctx: ModerationContext): Promise<ModActionResult> {
    // Validate, execute, create case, notify
  }
}

export const moderationService = new ModerationService();
```

### Gate Permission System

Custom RBAC for fine-grained permissions:

```typescript
// In command handler
const gate = Gate.from(interaction);
if (!gate || !await gate.requireAuth('mod.ban')) return;

// Gate checks:
// 1. Custom permission grants in database
// 2. Falls back to Discord permissions
```

### Fluent Container Builder

Discord messages built with fluent API:

```typescript
successContainer()
  .h2('User Banned')
  .text(`Banned ${user.tag}`)
  .field('Reason', reason)
  .footer(`Case #${caseNumber}`);
```

### Result Objects

Operations return result objects instead of throwing:

```typescript
interface ModActionResult {
  success: boolean;
  caseNumber?: CaseNumber;
  error?: string;
  userNotified: boolean;
}
```

## Database Schema

Key models in Prisma schema:

| Model | Purpose |
|-------|---------|
| `Guild` | Server configuration |
| `User` | User data per guild |
| `ModCase` | Moderation case tracking |
| `ModConfig` | Server mod settings |
| `Mute` | Active mute tracking |
| `Evidence` | Evidence files and URLs per case |
| `EvidenceAmendment` | Append-only evidence history |
| `MessageSnapshot` | Captured Discord message state |
| `UserXP` | Text message XP |
| `UserVoiceXP` | Voice channel XP |
| `UserReputation` | Reputation scores |
| `TempVoiceChannel` | Temp voice tracking |
| `LogConfig` | Audit log settings |
| `PermissionGrant` | Custom RBAC grants |

## Caching Strategy

Redis is used for:

| Purpose | Pattern |
|---------|---------|
| Configuration | Cache-aside with TTL |
| Rate limiting | Sliding window counter |
| Distributed locks | `RedisLock` class |
| Pub/Sub | Event broadcasting |
| Sorted sets | Leaderboards |

## Job Queue

BullMQ handles scheduled tasks:

| Job | Purpose |
|-----|---------|
| `TempbanScheduler` | Scheduled unbans |
| `MuteScheduler` | Scheduled unmutes |
| `LoggingService` | Async log writing |

## Microservices

### Watermark Service (Rust)

Located in `services/watermark-rs/`, this is a high-performance image watermarking microservice written in Rust. It handles applying watermarks to evidence images before download.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/watermark` | POST | Apply watermark to image |

**Features:**
- 10-50x faster than Node.js Sharp-based watermarking
- ~100MB less memory usage (no browser process)
- Supports PNG, JPEG, and WebP formats
- Automatic fallback to Sharp if service is unavailable

**Building:**
```bash
cd services/watermark-rs
cargo build --release
```

The service is automatically started by `pnpm dev:env` if the binary exists.

### Image Generation Service (Rust)

Located in `services/image-gen-rs/`, this microservice generates all image assets (rank cards, leaderboards, bonk memes) using `tiny-skia` for 2D rendering and `cosmic-text` for font layout.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/bonk` | POST | Generate bonk meme image |
| `/rank` | POST | Generate XP rank card |
| `/leaderboard` | POST | Generate leaderboard card |

**Features:**
- Sub-10ms image generation (vs ~150-300ms with Puppeteer)
- ~300MB less memory usage (no Chromium process)
- Embedded assets and fonts (no filesystem dependencies at runtime)
- Supports PNG, JPEG, and WebP avatar formats

**Building:**
```bash
cd services/image-gen-rs
cargo build --release
```

The service is automatically started by `pnpm dev:env` if the binary exists.

## Related Documentation

- [BotClient](core/bot-client.md) - Client initialization details
- [Gate System](core/gate-system.md) - RBAC system
- [Dashboard Setup](dashboard.md) - Dashboard configuration and OAuth
- [Database API](api/database.md) - Database helpers
- [Redis API](api/redis.md) - Caching utilities
