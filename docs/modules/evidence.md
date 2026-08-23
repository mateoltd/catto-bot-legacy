<script setup>
const corsFields = [
  { key: 'bucket', label: 'Bucket name', placeholder: 'mod-evidence-staging' },
  { key: 'origin', label: 'Dashboard origin', placeholder: 'http://localhost:3000' },
  { key: 'region', label: 'B2 region', placeholder: 'us-east-005', tabs: ['AWS CLI'] },
];

const corsRules = JSON.stringify([{
  corsRuleName: 'evidenceUploads',
  allowedOrigins: ['{{origin}}'],
  allowedOperations: ['s3_put', 's3_get', 's3_head'],
  allowedHeaders: ['authorization', 'content-type', 'content-length', 'x-amz-content-sha256', 'x-amz-date'],
  exposeHeaders: ['ETag'],
  maxAgeSeconds: 3600,
}], null, 2);

const awsCorsConfig = JSON.stringify({
  CORSRules: [{
    AllowedOrigins: ['{{origin}}'],
    AllowedMethods: ['PUT', 'GET', 'HEAD'],
    AllowedHeaders: ['authorization', 'content-type', 'content-length', 'x-amz-content-sha256', 'x-amz-date'],
    ExposeHeaders: ['ETag'],
    MaxAgeSeconds: 3600,
  }],
}, null, 2);

const corsCommands = [
  {
    label: 'B2 CLI',
    template: `b2 bucket update --cors-rules '${corsRules}' {{bucket}} allPrivate`,
  },
  {
    label: 'AWS CLI',
    template: `aws s3api put-bucket-cors \\\n  --bucket {{bucket}} \\\n  --endpoint-url https://s3.{{region}}.backblazeb2.com \\\n  --cors-configuration '${awsCorsConfig}'`,
  },
];
</script>

# Evidence System

> Location: `src/modules/moderation/services/EvidenceService.ts`, `src/lib/storage/`

Tamper-evident evidence storage for moderation cases, built on Backblaze B2 (S3-compatible) with HMAC-SHA256 integrity signing.

## Architecture

```
Browser                    Bot API                    Backblaze B2
  │                          │                           │
  │  POST /evidence          │                           │
  │  (action: initiate)      │                           │
  │─────────────────────────>│  Create PENDING record    │
  │                          │  Generate presigned URL   │
  │  { uploadUrl, id }       │                           │
  │<─────────────────────────│                           │
  │                          │                           │
  │  PUT uploadUrl (file)    │                           │
  │──────────────────────────────────────────────────────>│
  │                          │                           │
  │  POST /evidence          │                           │
  │  (action: confirm)       │                           │
  │  + SHA-256 hash          │                           │
  │─────────────────────────>│  HEAD object (verify)     │
  │                          │──────────────────────────>│
  │                          │  HMAC sign                │
  │                          │  Set VERIFIED             │
  │  { evidence }            │                           │
  │<─────────────────────────│                           │
```

## Setup

### 1. Create a Backblaze B2 Account and Bucket

1. Sign up at [backblaze.com](https://www.backblaze.com/)
2. Enable B2 Cloud Storage
3. Create a bucket (private). Note the **Endpoint URL** — it has the form `s3.<region>.backblazeb2.com`

### 2. Create an Application Key

**You cannot use your master application key with the S3-Compatible API.** Create a dedicated application key:

1. Go to **App Keys** in the B2 dashboard
2. Click **Add a New Application Key**
3. Set the key name (e.g. `catto-evidence`)
4. Restrict to the evidence bucket (recommended)
5. Required capabilities: `listBuckets`, `readBuckets`, `listFiles`, `readFiles`, `writeFiles`, `deleteFiles`
6. Save the **applicationKeyId** and **applicationKey** (shown only once)

### 3. Configure CORS (Required for Browser Uploads)

Browser-based uploads via presigned URLs require CORS rules on the bucket. Fill in your values below and copy the command for either the B2 CLI (`pip install b2-cli`) or the AWS CLI.

<CommandBuilder :fields="corsFields" :commands="corsCommands" />

::: tip
For development, use `http://localhost:3000` as the origin. In production, restrict this to your actual dashboard domain. The AWS CLI variant requires `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` env vars set to your B2 application key credentials.
:::

### 4. Environment Variables

```env
# Backblaze B2 (S3-compatible)
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
B2_KEY_ID=your-application-key-id
B2_APP_KEY=your-application-key
B2_BUCKET_NAME=your-bucket-name
B2_BUCKET_ID=your-bucket-id

# Evidence integrity signing (generate with: openssl rand -hex 32)
EVIDENCE_HMAC_SECRET=your-64-character-hex-secret

# Dashboard URL (used for evidence links in Discord)
DASHBOARD_URL=https://your-dashboard-domain.com
```

All B2 variables are optional. If not set, the evidence system operates without file storage (URL evidence still works).

::: warning
If B2 storage is configured but `EVIDENCE_HMAC_SECRET` is missing or shorter than 32 characters, the bot will log a warning at startup. Evidence uploads will work but **without integrity signatures**, which defeats tamper-evidence guarantees. Always configure HMAC signing in production.
:::

## B2 S3-Compatible API Notes

| Detail | Value |
|--------|-------|
| Endpoint format | `s3.<region>.backblazeb2.com` |
| Authentication | AWS Signature v4 only (v2 not supported) |
| Application key | Dedicated key required (master key not supported) |
| Max single upload | 5 GB (use multipart for larger files) |
| Presigned URL expiry | 1 second to 1 week (604800s) |
| Path style | Supported and recommended (`forcePathStyle: true`) |
| Virtual-hosted style | Supported but less reliable with reverse proxies |
| Buckets per account | Max 100 |
| Versioning | Enabled by default |

### SDK Configuration

The `StorageService` configures the AWS SDK v3 S3 client with:

```typescript
new S3Client({
  endpoint: CONFIG.B2_ENDPOINT,
  region: CONFIG.B2_REGION,
  credentials: {
    accessKeyId: CONFIG.B2_KEY_ID,
    secretAccessKey: CONFIG.B2_APP_KEY,
  },
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});
```

- **`forcePathStyle: true`** — Uses path-style URLs (`s3.region.b2.com/bucket/key`) instead of virtual-hosted (`bucket.s3.region.b2.com/key`). More reliable across tools and reverse proxies.
- **`requestChecksumCalculation: 'WHEN_REQUIRED'`** — AWS SDK v3.729.0+ sends `x-amz-checksum-crc32` by default. B2 added support in July 2025, but `WHEN_REQUIRED` avoids sending it unnecessarily.

## Evidence Types

| Type | Description | Storage |
|------|-------------|---------|
| `IMAGE` | Screenshots, photos | B2 (presigned upload) |
| `VIDEO` | Screen recordings, clips | B2 (presigned upload) |
| `AUDIO` | Voice recordings | B2 (presigned upload) |
| `DOCUMENT` | PDFs, text files | B2 (presigned upload) |
| `URL` | External URLs | Database only |
| `DISCORD_URL` | Discord message links | Database only (weak evidence) |
| `MESSAGE_SNAPSHOT` | Captured message state | B2 (server-side) |

### Weak Evidence Warning

Cases that only contain `DISCORD_URL` evidence display a warning — Discord message links become unavailable if the messages are deleted. Moderators are encouraged to add stronger evidence (screenshots, snapshots).

## Evidence Status

| Status | Description |
|--------|-------------|
| `PENDING` | Upload initiated but not yet confirmed |
| `PROCESSING` | NSFW scan or signing in progress |
| `VERIFIED` | Passed all checks, HMAC signed, immutable |
| `FLAGGED` | Failed NSFW check, moderator confirmed safe |
| `REJECTED` | Illegal/explicit content, not stored |

## Integrity & Signing

Each piece of file evidence is signed with HMAC-SHA256:

1. Client computes SHA-256 of file content using `crypto.subtle` (browser)
2. Client sends hash to server in the confirm step
3. Server verifies file exists in B2 via `HeadObject`
4. Server computes HMAC-SHA256 signature over: `contentHash|evidenceId|guildId|caseId|uploadedById|timestamp`
5. Signature is stored alongside the evidence record

Verification: `SigningService.verify()` recomputes the HMAC and uses constant-time comparison.

## Message Snapshots

The "Capture Evidence" context menu command captures message state as tamper-evident snapshots.

### Capture Modal

Right-click a message → Apps → **Capture Evidence** opens a modal with three fields:

| Field | Description | Default |
|-------|-------------|---------|
| Case Number | Attach to an existing case. Leave empty to capture now and link later via a mod action. | Empty |
| Capture Range | How many messages to capture. Empty = just this message, a number (1-100) = this + next N messages, or paste a message link for an end point. | This message only |
| Delete Messages | Whether to delete the original messages after capture. Type "no" to preserve them. | Yes (deletes) |

::: tip
The capture flow is designed to replace Discord's "Delete Message" action — capture evidence first, then the messages are automatically removed. Type "no" only if you need to preserve the originals.
:::

### Capture Flow

1. Fetches messages in range from Discord
2. Serializes each message (content, author, attachments, embeds, reactions, stickers)
3. Downloads all attachments and uploads to B2 (using a UUID prefix for the storage path)
4. Computes SHA-256 of serialized JSON
5. Creates `MessageSnapshot` record in database
6. If a case number was provided, creates `Evidence` record linked to the case
7. If no case number, shows a select menu to take a mod action (warn, kick, ban, etc.) — the action creates the case and links the snapshot automatically
8. Computes HMAC signature using the real evidence ID and updates records
9. Deletes original messages (unless "no" was entered)

Snapshot data includes: author tag/avatar, message content, embeds, attachment metadata, sticker info, reactions, timestamps, and edit status.

## Amendments

Evidence records are immutable after creation. Changes are tracked via `EvidenceAmendment` — an append-only history log:

| Action | Description |
|--------|-------------|
| `NOTE_ADDED` | A note was appended |
| `DESCRIPTION_UPDATED` | The description was changed |
| `FLAGGED` | Marked as potentially problematic |
| `UNFLAGGED` | Flag removed after review |

Each amendment records: who, when, what changed (previous/new value), and why.

## Permissions

| Permission Key | Description |
|----------------|-------------|
| `mod.evidence.add` | Upload evidence, add URLs |
| `mod.evidence.list` | List/browse evidence |
| `mod.evidence.view` | View evidence content (presigned URLs) |
| `mod.evidence.capture` | Use the "Capture Evidence" context menu |

All default to requiring `ModerateMembers` Discord permission as fallback.

## API Routes

See [REST Routes — Evidence](../api/rest-routes.md#evidence-routes) for the full API reference.

## Dashboard

The moderator dashboard is a Next.js app at `/mod/`:

```
/mod/{guildId}/cases                    # Case list
/mod/{guildId}/cases/{caseNumber}       # Case detail + evidence
/mod/{guildId}/cases/{caseNumber}/evidence  # Full evidence view + upload
/mod/{guildId}/evidence                 # All evidence across cases
```

### Upload Flow (Browser)

1. User drops files or enters URLs on the upload component
2. For images: optional client-side NSFW scan via NSFWJS
3. `POST /evidence` (action: initiate) — creates `PENDING` record, returns presigned B2 URL
4. Browser `PUT`s file directly to B2 via presigned URL
5. Browser computes SHA-256 of file using `crypto.subtle`
6. `POST /evidence` (action: confirm) — server verifies + signs, sets `VERIFIED`
7. UI refreshes to show the verified evidence item

### Rate Limits

| Action | Limit |
|--------|-------|
| `evidence.upload` | 10 uploads/min |
| `evidence.view` | 60 views/min |
| `evidence.capture` | 5 captures/min |
| Upload weight | 2 GB/hour per user per guild |

## Storage Key Pattern

Files are organized in B2 as:

```
guilds/{guildId}/cases/{caseNumber}/evidence/{evidenceId}/{filename}
guilds/{guildId}/snapshots/{mediaPrefix}/media/{filename}
```

For snapshot media, `mediaPrefix` is a UUID generated at capture time to ensure all attachments for a single snapshot share a consistent storage path. This prefix is stored in the snapshot's `mediaStorageKeys` array for retrieval.

## Dependencies

**Bot (root `package.json`):**
- `@aws-sdk/client-s3` — S3 client for B2
- `@aws-sdk/s3-request-presigner` — Presigned URL generation

**Dashboard (`dashboard/package.json`):**
- `nsfwjs` — Client-side NSFW image detection (optional)

## Related

- [Moderation Module](moderation.md) — Case system, commands
- [REST Routes](../api/rest-routes.md) — API endpoints
- [Gate System](../core/gate-system.md) — Authorization system
- [Backblaze B2 S3-Compatible API Docs](https://www.backblaze.com/docs/cloud-storage-s3-compatible-api)
- [B2 CORS Configuration](https://www.backblaze.com/docs/cloud-storage-cross-origin-resource-sharing-rules)
- [B2 Browser Upload Sample](https://github.com/backblaze-b2-samples/b2-browser-upload)
