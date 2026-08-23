# Logging Service

> Location: `src/lib/logging.ts`

Audit logging service using BullMQ for reliable, rate-limited log delivery.

## Overview

The logging service:

- Queues log entries with BullMQ
- Sends logs to Discord via webhooks
- Handles rate limiting (50 logs/second)
- Retries failed deliveries
- Respects per-guild configuration

## Log Types

```typescript
enum LogType {
  Messages = 'messages',
  Voice = 'voice',
  VoiceState = 'voiceState',
  Tickets = 'tickets',
  Transcripts = 'transcripts',
  Roles = 'roles',
  Channels = 'channels',
  Members = 'members',
  Stage = 'stage',
  Events = 'events',
  Polls = 'polls',
  Emojis = 'emojis',
  Stickers = 'stickers',
  Webhooks = 'webhooks',
  Joins = 'joins',
  Leaves = 'leaves',
  Server = 'server',
}
```

## Basic Usage

### Using the Service

```typescript
import { loggingService, LogType } from '#lib/logging.js';
import { EmbedBuilder, Colors } from 'discord.js';

const embed = new EmbedBuilder()
  .setTitle('Message Deleted')
  .setDescription(`Message by ${author.tag} was deleted`)
  .setColor(Colors.Red)
  .setTimestamp();

await loggingService.log(guild.id, LogType.Messages, embed);
```

### Using the Helper Function

```typescript
import { logAction, LogType } from '#lib/logging.js';

await logAction({
  guildId: guild.id,
  type: LogType.Members,
  title: 'Member Banned',
  description: `${target.tag} was banned by ${moderator.tag}`,
  color: Colors.Red,
  fields: [
    { name: 'Reason', value: reason },
    { name: 'Case', value: `#${caseNumber}` },
  ],
  footer: `ID: ${target.id}`,
  thumbnail: target.displayAvatarURL(),
});
```

### Creating Log Embeds

```typescript
import { createLogEmbed, LogType } from '#lib/logging.js';

const embed = createLogEmbed({
  title: 'Role Created',
  description: `New role: ${role.name}`,
  color: Colors.Green,
  fields: [
    { name: 'Color', value: role.hexColor, inline: true },
    { name: 'Position', value: String(role.position), inline: true },
  ],
  footer: `Role ID: ${role.id}`,
  timestamp: new Date(),
});

await loggingService.log(guild.id, LogType.Roles, embed);
```

## API Reference

### `loggingService.log(guildId, type, embed, channelId?)`

Queue a log entry.

| Parameter | Type | Description |
|-----------|------|-------------|
| `guildId` | `string` | Guild ID |
| `type` | `LogType` | Type of log event |
| `embed` | `EmbedBuilder` | The embed to send |
| `channelId` | `string?` | Optional channel ID for ignore checking |

---

### `logAction(options)`

Helper to create and queue a log in one call.

| Option | Type | Description |
|--------|------|-------------|
| `guildId` | `string` | Guild ID |
| `type` | `LogType` | Type of log event |
| `title` | `string` | Embed title |
| `description` | `string?` | Embed description |
| `color` | `number?` | Embed color |
| `fields` | `Array?` | Embed fields |
| `footer` | `string?` | Footer text |
| `timestamp` | `Date?` | Timestamp |
| `thumbnail` | `string?` | Thumbnail URL |
| `channelId` | `string?` | Channel ID for ignore checking |

---

### `createLogEmbed(options)`

Create an embed without queuing.

| Option | Type | Description |
|--------|------|-------------|
| `title` | `string` | Embed title |
| `description` | `string?` | Embed description |
| `color` | `number?` | Embed color (default: Blue) |
| `fields` | `Array?` | Embed fields |
| `footer` | `string?` | Footer text |
| `timestamp` | `Date?` | Timestamp (default: now) |

**Returns:** `EmbedBuilder`

---

### `loggingService.destroy()`

Gracefully shut down the service.

```typescript
await loggingService.destroy();
```

## Queue Configuration

### Job Options

```typescript
defaultJobOptions: {
  attempts: 3,              // Retry up to 3 times
  backoff: {
    type: 'exponential',
    delay: 2000,            // Start with 2s, then 4s, then 8s
  },
  removeOnComplete: {
    age: 3600,              // Keep completed jobs for 1 hour
    count: 1000,
  },
  removeOnFail: {
    age: 86400,             // Keep failed jobs for 24 hours
  },
}
```

### Worker Options

```typescript
{
  concurrency: 5,           // Process up to 5 logs concurrently
  limiter: {
    max: 50,                // Max 50 jobs
    duration: 1000,         // per 1 second
  },
}
```

## Database Configuration

Logging configuration is stored in `LogConfig`:

```prisma
model LogConfig {
  guildId          String   @unique
  enabled          Boolean  @default(false)
  ignoredChannels  String[] @default([])

  // Per-type settings
  messagesEnabled  Boolean  @default(false)
  messagesWebhook  String?

  voiceEnabled     Boolean  @default(false)
  voiceWebhook     String?

  // ... other types
}
```

## Processing Flow

```
1. loggingService.log() called
        ↓
2. Job added to BullMQ queue
        ↓
3. Worker picks up job
        ↓
4. Fetch LogConfig from database
        ↓
5. Check if logging enabled
        ↓
6. Check if channel is ignored
        ↓
7. Get webhook URL for log type
        ↓
8. Send via WebhookClient
```

## Ignored Channels

Channels can be ignored per guild:

```typescript
// In LogConfig
ignoredChannels: ['123456789', '987654321']
```

Pass `channelId` to skip logging for ignored channels:

```typescript
await loggingService.log(
  guild.id,
  LogType.Messages,
  embed,
  message.channel.id // Will be checked against ignoredChannels
);
```

## Example: Listener Integration

```typescript
import { Listener } from '@sapphire/framework';
import { logAction, LogType } from '#lib/logging.js';
import { Colors } from 'discord.js';

export class MessageDeleteListener extends Listener {
  public constructor(context: Listener.LoaderContext) {
    super(context, {
      event: 'messageDelete',
    });
  }

  public async run(message: Message) {
    if (!message.guild || message.author?.bot) return;

    await logAction({
      guildId: message.guild.id,
      type: LogType.Messages,
      title: 'Message Deleted',
      description: message.content?.slice(0, 1000) || '*No content*',
      color: Colors.Red,
      fields: [
        { name: 'Author', value: `${message.author?.tag}`, inline: true },
        { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
      ],
      footer: `Message ID: ${message.id}`,
      channelId: message.channel.id,
    });
  }
}
```

## Related

- [BotClient](bot-client.md) - Service initialization
- [Database API](../api/database.md) - LogConfig storage
- [Redis API](../api/redis.md) - BullMQ backend
