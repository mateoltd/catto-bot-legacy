# REST API Routes

> Location: `src/routes/`

HTTP API endpoints built with Sapphire's API plugin.

## Base URL

```
http://localhost:4000/api
```

The port is configured via `API_PORT` environment variable (default: 4000).

## Authentication

Most routes require OAuth2 authentication. Use the login flow to obtain a session.

## General Routes

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "uptime": 12345.67,
  "timestamp": 1704067200000,
  "message": "Bot API is running"
}
```

---

### `GET /ping`

Simple ping endpoint.

**Response:**
```json
{
  "message": "pong",
  "timestamp": 1704067200000
}
```

---

### `GET /stats`

General statistics.

---

## Bot Routes

### `GET /bot/stats`

Comprehensive bot statistics.

**Response:**
```json
{
  "bot": {
    "username": "Catto",
    "id": "123456789",
    "avatar": "https://cdn.discordapp.com/...",
    "status": "online"
  },
  "guilds": {
    "total": 150,
    "database": 150
  },
  "users": {
    "total": 5000,
    "database": 3000
  },
  "channels": {
    "total": 2000
  },
  "uptime": {
    "milliseconds": 86400000,
    "seconds": 86400,
    "minutes": 1440,
    "hours": 24,
    "days": 1,
    "formatted": "1d 0h 0m"
  },
  "memory": {
    "heapUsed": 150,
    "heapTotal": 200,
    "rss": 250,
    "external": 10,
    "unit": "MB"
  },
  "ping": {
    "ws": 50
  },
  "logs": {
    "total": 12000
  }
}
```

---

## Guild Routes

### `GET /guilds`

List all guilds the bot is in.

**Response:**
```json
{
  "total": 150,
  "guilds": [
    {
      "id": "123456789",
      "name": "My Server",
      "icon": "https://cdn.discordapp.com/...",
      "memberCount": 500,
      "ownerId": "987654321",
      "createdAt": 1704067200000
    }
  ]
}
```

---

### `GET /guilds/:guildId`

Get information about a specific guild.

---

### `GET /guilds/:guildId/stats`

Get statistics for a guild.

---

### `GET /guilds/:guildId/channels-roles`

Get channels and roles for a guild.

---

## Logging Routes

### `GET /guilds/:guildId/logging/config`

Get logging configuration for a guild.

---

### `POST /guilds/:guildId/logging/setup`

Set up logging for a guild.

---

### `PATCH /guilds/:guildId/logging/toggle`

Toggle logging events.

---

### `GET /guilds/:guildId/logging/types`

Get available logging event types.

---

### `GET /guilds/:guildId/logging/ignored-channels`

Get ignored channels for logging.

---

### `DELETE /guilds/:guildId/logging`

Delete logging configuration.

---

## Moderation Routes

### `GET /guilds/:guildId/moderation/config`

Get moderation configuration.

---

### `GET /guilds/:guildId/moderation/cases`

List moderation cases.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | `number` | Page number |
| `limit` | `number` | Cases per page |
| `action` | `string` | Filter by action type |
| `moderatorId` | `string` | Filter by moderator |
| `targetId` | `string` | Filter by target user |

---

### `GET /guilds/:guildId/moderation/cases/:caseNumber`

Get a specific moderation case.

---

### `GET /guilds/:guildId/moderation/users/:userId`

Get moderation history for a user.

---

### `GET /guilds/:guildId/moderation/stats`

Get moderation statistics.

---

## Evidence Routes

### `GET /guilds/:guildId/moderation/evidence`

List evidence. If `caseNumber` is provided, returns evidence for that case. Otherwise returns paginated guild-wide evidence.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `caseNumber` | `number` | Filter by case number. If provided, returns case-specific evidence + summary. |
| `page` | `number` | Page number (default: 1) |
| `limit` | `number` | Items per page (default: 50, max: 100) |
| `type` | `string` | Filter by evidence type (IMAGE, VIDEO, URL, etc.) |
| `status` | `string` | Filter by status (PENDING, VERIFIED, FLAGGED) |
| `case` | `number` | Filter by case number (for guild-wide listing) |
| `tags` | `string` | Comma-separated tags to filter by |

**Response (case-specific):**
```json
{
  "evidence": [...],
  "summary": {
    "total": 3,
    "byType": { "IMAGE": 2, "DISCORD_URL": 1 },
    "byStatus": { "VERIFIED": 3 },
    "totalSizeBytes": 524288,
    "latestAt": "2026-01-30T...",
    "hasWeakEvidenceOnly": false
  }
}
```

**Response (guild-wide):**
```json
{
  "evidence": [...],
  "total": 150,
  "page": 1,
  "totalPages": 3
}
```

---

### `POST /guilds/:guildId/moderation/evidence` (action: initiate)

Initiate a file upload. Returns a presigned B2 upload URL.

**Body:**
```json
{
  "action": "initiate",
  "caseNumber": 413,
  "filename": "screenshot.png",
  "mimeType": "image/png",
  "sizeBytes": 204800
}
```

**Response:**
```json
{
  "evidenceId": "clx...",
  "uploadUrl": "https://s3.us-west-004.backblazeb2.com/...",
  "expiresAt": "2026-01-30T..."
}
```

---

### `POST /guilds/:guildId/moderation/evidence` (action: confirm)

Confirm an upload completed. Verifies file exists in B2, signs with HMAC.

**Body:**
```json
{
  "action": "confirm",
  "evidenceId": "clx...",
  "contentHash": "sha256hex..."
}
```

---

### `POST /guilds/:guildId/moderation/evidence` (action: url)

Add URL-type evidence. Auto-detects Discord message links.

**Body:**
```json
{
  "action": "url",
  "caseNumber": 413,
  "url": "https://discord.com/channels/...",
  "description": "User's message before deletion"
}
```

---

### `POST /guilds/:guildId/moderation/evidence` (action: preview-og)

Preview OpenGraph metadata for a URL without creating evidence. Useful for showing link previews in the UI.

**Body:**
```json
{
  "action": "preview-og",
  "url": "https://example.com/article"
}
```

**Response:**
```json
{
  "og": {
    "title": "Article Title",
    "description": "Article description...",
    "image": "https://example.com/image.png",
    "siteName": "Example Site"
  }
}
```

---

### `POST /guilds/:guildId/moderation/evidence` (action: bulk-amend)

Apply a single amendment to multiple evidence items at once.

**Body:**
```json
{
  "action": "bulk-amend",
  "evidenceIds": ["clx123...", "clx456..."],
  "amendAction": "FLAGGED",
  "reason": "Marked for review by admin"
}
```

**Response:**
```json
{
  "results": [...],
  "errors": [
    { "evidenceId": "clx789...", "error": "Evidence not found" }
  ]
}
```

---

### `GET /guilds/:guildId/moderation/evidence/:evidenceId`

Get evidence detail. Supports `?action=view-url` for presigned download URL and `?action=history` for amendment history.

---

### `POST /guilds/:guildId/moderation/evidence/:evidenceId`

Add an amendment to evidence (append-only).

**Body:**
```json
{
  "action": "NOTE_ADDED",
  "newValue": "Confirmed this is the user's alt account",
  "reason": "Cross-referenced with IP logs"
}
```

---

### `GET /guilds/:guildId/moderation/dashboard-access`

Get the authenticated user's mod dashboard permissions for a guild.

**Response:**
```json
{
  "userId": "123456789",
  "guildId": "987654321",
  "isAdmin": false,
  "isOwner": false,
  "hasAccess": true,
  "sections": {
    "cases": true,
    "evidence": true,
    "evidenceAdd": true,
    "evidenceCapture": false
  }
}
```

---

## Permissions Routes

### `GET /guilds/:guildId/permissions/registry`

Get the permission registry.

---

### `GET /guilds/:guildId/permissions/grants`

List permission grants.

---

### `POST /guilds/:guildId/permissions/grants`

Create a permission grant.

**Body:**
```json
{
  "subjectType": "ROLE",
  "subjectId": "123456789",
  "resourceType": "COMMAND",
  "resourceKey": "mod.ban",
  "effect": "ALLOW"
}
```

---

### `DELETE /guilds/:guildId/permissions/grants/:grantId`

Delete a permission grant.

---

## Rewards Routes

### `GET /guilds/:guildId/rewards`

List rewards.

---

### `POST /guilds/:guildId/rewards`

Create a reward.

---

### `GET /guilds/:guildId/rewards/:rewardId`

Get a specific reward.

---

### `DELETE /guilds/:guildId/rewards/:rewardId`

Delete a reward.

---

### `GET /guilds/:guildId/rewards/stats`

Get reward statistics.

---

### `GET /guilds/:guildId/rewards/users/:userId`

Get user's rewards.

---

### `GET /guilds/:guildId/rewards/templates`

List reward templates.

---

### `GET /guilds/:guildId/rewards/templates/:templateName`

Get a reward template.

---

## Temp Voice Routes

### `GET /guilds/:guildId/temp-voice/config`

Get temp voice configuration.

---

### `POST /guilds/:guildId/temp-voice/config`

Create temp voice configuration.

---

### `PATCH /guilds/:guildId/temp-voice/config`

Update temp voice configuration.

---

### `DELETE /guilds/:guildId/temp-voice/config`

Delete temp voice configuration.

---

### `GET /guilds/:guildId/temp-voice/channels`

List active temp voice channels.

---

### `GET /guilds/:guildId/temp-voice/stats`

Get temp voice statistics.

---

### `POST /guilds/:guildId/temp-voice/setup`

Set up temp voice system.

---

### `POST /guilds/:guildId/temp-voice/validate`

Validate temp voice configuration.

---

### `POST /guilds/:guildId/temp-voice/join-channels`

Add a join-to-create channel.

---

### `DELETE /guilds/:guildId/temp-voice/join-channels`

Remove a join-to-create channel.

---

## XP Routes (Text)

### `GET /guilds/:guildId/xp/config`

Get XP configuration.

---

### `GET /guilds/:guildId/xp/leaderboard`

Get XP leaderboard.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | `number` | Page number |
| `limit` | `number` | Users per page |

---

### `GET /guilds/:guildId/xp/stats`

Get XP statistics.

---

### `POST /guilds/:guildId/xp/recalc`

Recalculate XP for all users.

---

### `POST /guilds/:guildId/xp/reset-guild`

Reset XP for entire guild.

---

### `POST /guilds/:guildId/xp/reset-user`

Reset XP for a specific user.

**Body:**
```json
{
  "userId": "123456789"
}
```

---

## Voice XP Routes

### `GET /guilds/:guildId/voice-xp/config`

Get voice XP configuration.

---

### `GET /guilds/:guildId/voice-xp/leaderboard`

Get voice XP leaderboard.

---

### `GET /guilds/:guildId/voice-xp/stats`

Get voice XP statistics.

---

### `GET /guilds/:guildId/voice-xp/sessions`

Get active voice sessions.

---

### `POST /guilds/:guildId/voice-xp/recalc`

Recalculate voice XP.

---

### `POST /guilds/:guildId/voice-xp/reset-guild`

Reset voice XP for entire guild.

---

### `POST /guilds/:guildId/voice-xp/reset-user`

Reset voice XP for a user.

---

## OAuth Routes

### `GET /oauth/login`

Initiate OAuth2 login flow.

---

### `GET /oauth/callback`

OAuth2 callback handler.

---

## User Routes

### `GET /users/@me`

Get the authenticated user's information.

---

## Creating Routes

To create a new route:

```typescript
import { Route } from '@sapphire/plugin-api';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Route.Options>({
  route: 'my-route',
})
export class MyRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      methods: ['GET', 'POST'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    // Handle GET
    if (request.method === 'GET') {
      return response.json({ data: 'value' });
    }

    // Handle POST
    if (request.method === 'POST') {
      const body = request.body;
      return response.json({ received: body });
    }
  }
}
```

---

## Related

- [Database API](database.md) - Data access layer
- [Architecture](../architecture.md) - System overview
