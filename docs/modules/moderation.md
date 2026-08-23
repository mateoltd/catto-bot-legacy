# Moderation Module

> Location: `src/modules/moderation/`

Comprehensive moderation system with case tracking, scheduling, and user management.

## Features

- **Ban/Unban** - Permanent and temporary bans
- **Kick** - Remove users from server
- **Warn** - Issue warnings with escalation
- **Timeout** - Discord's native timeout
- **Mute** - Text, voice, or both (role-based)
- **Case System** - Track all mod actions
- **Evidence System** - File uploads, URL evidence, message snapshots with HMAC signing
- **User Notes** - Moderator notes per user
- **User Flags** - Mark users (suspicious, trusted, etc.)
- **Scheduled Actions** - Auto-unban, auto-unmute
- **Moderator Dashboard** - Web UI for case/evidence management

## Structure

```
src/modules/moderation/
├── services/
│   ├── ModerationService.ts    # Core moderation actions
│   ├── MuteService.ts          # Mute management
│   ├── MuteScheduler.ts        # Scheduled unmutes
│   ├── TempbanScheduler.ts     # Scheduled unbans
│   ├── CaseService.ts          # Case CRUD
│   ├── CaseTemplateService.ts  # Action templates
│   ├── EvidenceService.ts      # Evidence upload, snapshots, amendments
│   ├── NotesService.ts         # User notes
│   ├── WarningService.ts       # Warning escalation
│   ├── UserFlagService.ts      # User flags
│   └── ModEventLogger.ts       # Event analytics
├── handlers/
│   └── index.ts                # Command handlers
├── discord/
│   ├── embeds.ts               # Mod embeds
│   ├── components.ts           # Buttons, selects
│   └── modals.ts               # Input modals
├── domain/
│   ├── types.ts                # Type definitions
│   └── evidence-types.ts       # Evidence type definitions
└── index.ts                    # Exports
```

## Services

### ModerationService

Core moderation actions:

```typescript
import { moderationService } from '#modules/moderation/index.js';

// Ban a user
const result = await moderationService.banById({
  interaction,
  guild,
  moderator,
  targetId: user.id,
  reason: 'Spam',
  deleteMessageDays: 7,
});

// Kick a user
await moderationService.kickById({
  interaction,
  guild,
  moderator,
  targetId: user.id,
  reason: 'Breaking rules',
});

// Warn a user
await moderationService.warnById({
  interaction,
  guild,
  moderator,
  targetId: user.id,
  reason: 'First warning',
});

// Timeout a user
await moderationService.timeoutById({
  interaction,
  guild,
  moderator,
  targetId: user.id,
  reason: 'Timeout',
  duration: 3600, // seconds
});
```

### MuteService

Role-based muting:

```typescript
import { muteService } from '#modules/moderation/index.js';

// Mute text
await muteService.muteText(guild, targetId, moderatorId, reason, duration?);

// Mute voice
await muteService.muteVoice(guild, targetId, moderatorId, reason, duration?);

// Mute both
await muteService.muteBoth(guild, targetId, moderatorId, reason, duration?);

// Unmute
await muteService.unmute(guild, targetId, moderatorId, muteType);
```

### CaseService

Case management:

```typescript
import { caseService } from '#modules/moderation/index.js';

// Create case
const modCase = await caseService.createCase({
  guildId,
  moderatorId,
  targetId,
  action: ModAction.BAN,
  reason,
});

// Get case
const modCase = await caseService.getCase(guildId, caseNumber);

// Update case
await caseService.updateCase(guildId, caseNumber, {
  reason: 'Updated reason',
  status: CaseStatus.CLOSED,
});

// Get user cases
const cases = await caseService.getUserCases(guildId, userId);
```

### NotesService

Moderator notes:

```typescript
import { notesService } from '#modules/moderation/index.js';

// Add note
await notesService.addNote(guildId, targetId, moderatorId, 'Note content');

// Get notes
const notes = await notesService.getNotes(guildId, targetId);

// Delete note
await notesService.deleteNote(noteId);
```

### WarningService

Warning escalation:

```typescript
import { warningService } from '#modules/moderation/index.js';

// Get warning count
const count = await warningService.getWarningCount(guildId, userId);

// Check escalation threshold
const shouldEscalate = await warningService.shouldEscalate(guildId, userId);
```

## Types

### ModActionResult

```typescript
interface ModActionResult {
  success: boolean;
  caseNumber?: CaseNumber;
  error?: string;
  userNotified: boolean;
}
```

### ModAction

```typescript
enum ModAction {
  BAN = 'BAN',
  UNBAN = 'UNBAN',
  KICK = 'KICK',
  TIMEOUT = 'TIMEOUT',
  WARN = 'WARN',
  MUTE = 'MUTE',
  UNMUTE = 'UNMUTE',
  SOFTBAN = 'SOFTBAN',
  TEMPBAN = 'TEMPBAN',
}
```

### CaseStatus

```typescript
enum CaseStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  VOID = 'VOID',
}
```

### MuteType

```typescript
enum MuteType {
  TEXT = 'TEXT',
  VOICE = 'VOICE',
  BOTH = 'BOTH',
}
```

### UserFlag

```typescript
enum UserFlag {
  SUSPICIOUS = 'SUSPICIOUS',
  TRUSTED = 'TRUSTED',
  ALT_ACCOUNT = 'ALT_ACCOUNT',
  UNDER_REVIEW = 'UNDER_REVIEW',
}
```

## Scheduling

### TempbanScheduler

Handles temporary bans with BullMQ:

```typescript
import { tempbanScheduler } from '#modules/moderation/services/TempbanScheduler.js';

// Schedule unban
await tempbanScheduler.scheduleUnban(guildId, userId, unbanAt);

// Cancel scheduled unban
await tempbanScheduler.cancelUnban(guildId, userId);
```

### MuteScheduler

Handles timed mutes:

```typescript
import { muteScheduler } from '#modules/moderation/services/MuteScheduler.js';

// Schedule unmute
await muteScheduler.scheduleUnmute(guildId, userId, muteType, unmuteAt);

// Cancel scheduled unmute
await muteScheduler.cancelUnmute(guildId, userId);
```

## Database Models

### ModCase

```prisma
model ModCase {
  id          Int        @id @default(autoincrement())
  guildId     String
  caseNumber  Int        // Auto-increment per guild
  action      ModAction
  status      CaseStatus @default(OPEN)
  moderatorId String
  targetId    String
  reason      String?
  evidence    String[]
  duration    Int?       // For temp actions
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@unique([guildId, caseNumber])
}
```

### Mute

```prisma
model Mute {
  id          Int      @id @default(autoincrement())
  guildId     String
  userId      String
  moderatorId String
  type        MuteType
  reason      String?
  expiresAt   DateTime?
  createdAt   DateTime @default(now())

  @@unique([guildId, userId, type])
}
```

## Commands

All moderation commands support both **slash commands** (`/mod <subcommand>`) and **prefix commands** (`!<command>`). Both invoke the same shared handlers, so behavior is identical regardless of how the command is triggered.

### Slash Commands

The main slash command is `/mod` with subcommands:

| Subcommand | Description |
|------------|-------------|
| `ban` | Ban a user |
| `unban` | Unban a user |
| `kick` | Kick a user |
| `warn` | Warn a user |
| `timeout` | Timeout a user |
| `mute text` | Mute text channels |
| `mute voice` | Mute voice channels |
| `mute both` | Mute both |
| `unmute` | Unmute a user |
| `case view` | View a case |
| `case edit` | Edit a case |
| `case close` | Close a case |
| `history` | View user history |
| `notes add` | Add a note |
| `notes view` | View notes |
| `panel` | Open mod panel |
| `evidence add` | Get dashboard link to add evidence |
| `evidence list` | View evidence summary for a case |

### Prefix Commands

Top-level prefix aliases for quick access:

| Command | Example | Equivalent |
|---------|---------|------------|
| `!ban` | `!ban @user reason` | `/mod ban` |
| `!kick` | `!kick @user reason` | `/mod kick` |
| `!warn` | `!warn @user reason` | `/mod warn` |
| `!timeout` | `!timeout @user 1h reason` | `/mod timeout` |
| `!softban` | `!softban @user reason` | `/mod softban` |
| `!tempban` | `!tempban @user 7d reason` | `/mod tempban` |
| `!unban` | `!unban <userId> reason` | `/mod unban` |
| `!mute` | `!mute @user reason` | `/mod mute` |
| `!unmute` | `!unmute @user` | `/mod unmute` |
| `!case` | `!case 42` | `/mod case view` |
| `!history` | `!history @user` | `/mod history` |
| `!evidence` | `!evidence add 42` / `!evidence list 42` | `/mod evidence` |
| `!note` | `!note add @user text` / `!note list @user` | `/mod notes` |
| `!voice` | `!voice where @user` / `!voice snapshot #channel` | `/mod voice` |

Simple aliases (ban, kick, warn, timeout, softban, tempban, unban, case, history) are registered via a data-driven registry in `aliases/_registry.ts`. Complex aliases with subcommand routing (mute, unmute, evidence, note, voice) are individual files.

### Context Menu Commands

| Command | Description |
|---------|-------------|
| `Capture Evidence` | Capture a message (or range) as a snapshot and attach to a case |

## Evidence System

The evidence system provides tamper-evident storage for moderation evidence. See the dedicated [Evidence](evidence.md) documentation for full details.

### Quick Overview

- **File uploads** go through Backblaze B2 via presigned URLs (direct client-to-storage)
- **URL evidence** supports both regular URLs and Discord message links
- **Message snapshots** capture message content, attachments, and metadata
- **Integrity** is ensured via SHA-256 content hashing and HMAC-SHA256 signing
- **Amendments** provide an append-only history log (no edits/deletes)
- **Moderator dashboard** at `/mod/{guildId}/cases/{caseNumber}/evidence`

## Related

- [Evidence System](evidence.md) - Evidence storage, B2, signing, dashboard
- [Gate System](../core/gate-system.md) - Authorization
- [Logging](../core/logging.md) - Audit logging
- [Commands](../commands/creating-commands.md) - Command system
