-- Preserve legacy temp voice channels as durable aggregates. Discord presence is reconciled on
-- startup, so migrated ownership begins healthy and is corrected from observed state before any
-- ownership deadline or external projection is emitted.

ALTER TABLE "temp_voice_configs" DROP COLUMN "ownerLeaveStrategy";
ALTER TABLE "temp_voice_configs" DROP COLUMN "controlPanelOnCreate";
ALTER TABLE "temp_voice_configs" ADD COLUMN "drainingAt" TIMESTAMP(3);

-- Legacy API values were stored in bits per second. The rewritten config model stores kbps while
-- user preferences and active-channel overrides continue to use Discord's bits-per-second unit.
UPDATE "temp_voice_configs"
SET "defaultBitrate" = "defaultBitrate" / 1000
WHERE "defaultBitrate" >= 8000;

ALTER TABLE "temp_voice_configs"
ALTER COLUMN "defaultBitrate" SET DEFAULT 64;
ALTER TABLE "temp_voice_configs"
ALTER COLUMN "deleteDelaySeconds" SET DEFAULT 300;

ALTER TABLE "temp_voice_channels" RENAME TO "temp_voice_channels_legacy";

CREATE TYPE "TempVoiceLifecycle" AS ENUM (
    'CREATING',
    'ACTIVE',
    'DELETE_PENDING',
    'DELETING',
    'DELETE_FAILED',
    'DELETED'
);

CREATE TYPE "TempVoiceOwnershipStatus" AS ENUM (
    'OWNER_PRESENT',
    'OWNER_GRACE',
    'CLAIMABLE'
);

CREATE TYPE "TempVoiceEffectKind" AS ENUM (
    'CREATE_CHANNEL',
    'MOVE_OWNER',
    'DISCONNECT_USERS',
    'DELETE_CHANNEL',
    'RECONCILE_CHANNEL',
    'RECONCILE_PERMISSIONS',
    'RECONCILE_PANEL',
    'DELIVER_OWNERSHIP_NOTICE',
    'DELIVER_OWNER_DM'
);

CREATE TYPE "TempVoiceOutboxStatus" AS ENUM (
    'PENDING',
    'ENQUEUED',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);

CREATE TYPE "TempVoiceDeliveryKind" AS ENUM (
    'CONTROL_PANEL',
    'OWNERSHIP_NOTICE',
    'OWNER_DM'
);

CREATE TYPE "TempVoiceDeliveryStatus" AS ENUM (
    'PENDING',
    'DELIVERED',
    'FAILED',
    'SUPERSEDED'
);

CREATE TABLE "temp_voice_channels_new" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT,
    "ownerId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "lifecycle" "TempVoiceLifecycle" NOT NULL DEFAULT 'CREATING',
    "ownershipStatus" "TempVoiceOwnershipStatus" NOT NULL DEFAULT 'OWNER_PRESENT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "ownershipEpoch" INTEGER NOT NULL DEFAULT 0,
    "ownerAbsentAt" TIMESTAMP(3),
    "claimableAt" TIMESTAMP(3),
    "createdByJoinChannelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customName" TEXT,
    "customUserLimit" INTEGER,
    "customBitrate" INTEGER,
    "customRegion" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "allowedUserIds" JSONB NOT NULL DEFAULT '[]',
    "deniedUserIds" JSONB NOT NULL DEFAULT '[]',
    "trustedUserIds" JSONB NOT NULL DEFAULT '[]',
    "managedUserIds" JSONB NOT NULL DEFAULT '[]',
    "emptySince" TIMESTAMP(3),
    "deleteAfter" TIMESTAMP(3),
    "nextReconcileAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReconciledAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "deletedAt" TIMESTAMP(3),
    "controlPanelMessageId" TEXT,
    "controlPanelChannelId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temp_voice_channels_new_pkey" PRIMARY KEY ("id")
);

INSERT INTO "temp_voice_channels_new" (
    "id",
    "guildId",
    "channelId",
    "ownerId",
    "operationId",
    "lifecycle",
    "ownershipStatus",
    "revision",
    "ownershipEpoch",
    "ownerAbsentAt",
    "claimableAt",
    "createdByJoinChannelId",
    "createdAt",
    "lastActiveAt",
    "customName",
    "customUserLimit",
    "customBitrate",
    "customRegion",
    "isLocked",
    "isHidden",
    "allowedUserIds",
    "deniedUserIds",
    "trustedUserIds",
    "managedUserIds",
    "emptySince",
    "deleteAfter",
    "nextReconcileAt",
    "controlPanelMessageId",
    "controlPanelChannelId",
    "metadata",
    "updatedAt"
)
SELECT
    legacy."id",
    legacy."guildId",
    legacy."channelId",
    legacy."ownerId",
    'legacy:' || legacy."id",
    CASE
        WHEN legacy."deletionScheduledAt" IS NULL THEN 'ACTIVE'::"TempVoiceLifecycle"
        ELSE 'DELETE_PENDING'::"TempVoiceLifecycle"
    END,
    'OWNER_PRESENT'::"TempVoiceOwnershipStatus",
    0,
    0,
    NULL,
    NULL,
    legacy."createdByJoinChannelId",
    legacy."createdAt",
    legacy."lastActiveAt",
    legacy."customName",
    legacy."customUserLimit",
    legacy."customBitrate",
    legacy."customRegion",
    legacy."isLocked",
    legacy."isHidden",
    legacy."allowedUserIds",
    legacy."deniedUserIds",
    legacy."trustedUserIds",
    (
        SELECT COALESCE(jsonb_agg(ids.member_id ORDER BY ids.member_id), '[]'::jsonb)
        FROM (
            SELECT DISTINCT member_id
            FROM jsonb_array_elements_text(
                jsonb_build_array(legacy."ownerId") ||
                legacy."allowedUserIds" ||
                legacy."deniedUserIds" ||
                legacy."trustedUserIds"
            ) AS member_ids(member_id)
        ) AS ids
    ),
    legacy."deletionScheduledAt",
    legacy."deletionScheduledAt",
    CURRENT_TIMESTAMP,
    legacy."controlPanelMessageId",
    legacy."controlPanelChannelId",
    legacy."metadata",
    legacy."updatedAt"
FROM "temp_voice_channels_legacy" AS legacy;

DROP TABLE "temp_voice_channels_legacy";
ALTER TABLE "temp_voice_channels_new" RENAME TO "temp_voice_channels";
ALTER TABLE "temp_voice_channels"
RENAME CONSTRAINT "temp_voice_channels_new_pkey" TO "temp_voice_channels_pkey";

CREATE TABLE "temp_voice_outbox" (
    "id" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "kind" "TempVoiceEffectKind" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "dedupeKey" TEXT NOT NULL,
    "status" "TempVoiceOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "temp_voice_outbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "temp_voice_deliveries" (
    "id" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "kind" "TempVoiceDeliveryKind" NOT NULL,
    "epoch" INTEGER NOT NULL DEFAULT 0,
    "destinationId" TEXT,
    "messageId" TEXT,
    "renderHash" TEXT,
    "status" "TempVoiceDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temp_voice_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "temp_voice_channels_channelId_key" ON "temp_voice_channels"("channelId");
CREATE UNIQUE INDEX "temp_voice_channels_operationId_key" ON "temp_voice_channels"("operationId");
CREATE INDEX "temp_voice_channels_guildId_idx" ON "temp_voice_channels"("guildId");
CREATE INDEX "temp_voice_channels_ownerId_idx" ON "temp_voice_channels"("ownerId");
CREATE INDEX "temp_voice_channels_channelId_idx" ON "temp_voice_channels"("channelId");
CREATE INDEX "temp_voice_channels_lifecycle_nextReconcileAt_idx" ON "temp_voice_channels"("lifecycle", "nextReconcileAt");
CREATE INDEX "temp_voice_channels_ownershipStatus_claimableAt_idx" ON "temp_voice_channels"("ownershipStatus", "claimableAt");
CREATE INDEX "temp_voice_channels_deleteAfter_idx" ON "temp_voice_channels"("deleteAfter");

CREATE UNIQUE INDEX "temp_voice_outbox_dedupeKey_key" ON "temp_voice_outbox"("dedupeKey");
CREATE INDEX "temp_voice_outbox_status_availableAt_idx" ON "temp_voice_outbox"("status", "availableAt");
CREATE INDEX "temp_voice_outbox_status_completedAt_idx" ON "temp_voice_outbox"("status", "completedAt");
CREATE INDEX "temp_voice_outbox_aggregateId_revision_idx" ON "temp_voice_outbox"("aggregateId", "revision");

CREATE UNIQUE INDEX "temp_voice_deliveries_aggregateId_kind_epoch_key" ON "temp_voice_deliveries"("aggregateId", "kind", "epoch");
CREATE INDEX "temp_voice_deliveries_status_updatedAt_idx" ON "temp_voice_deliveries"("status", "updatedAt");

ALTER TABLE "temp_voice_outbox"
ADD CONSTRAINT "temp_voice_outbox_aggregateId_fkey"
FOREIGN KEY ("aggregateId") REFERENCES "temp_voice_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "temp_voice_deliveries"
ADD CONSTRAINT "temp_voice_deliveries_aggregateId_fkey"
FOREIGN KEY ("aggregateId") REFERENCES "temp_voice_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adopt existing control panels into the stable delivery slot so startup edits or replaces each
-- message instead of posting a duplicate panel beside it.
INSERT INTO "temp_voice_deliveries" (
    "id",
    "aggregateId",
    "kind",
    "epoch",
    "destinationId",
    "messageId",
    "status",
    "attempts",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy-control-panel:' || channel."id",
    channel."id",
    'CONTROL_PANEL'::"TempVoiceDeliveryKind",
    0,
    channel."controlPanelChannelId",
    channel."controlPanelMessageId",
    'PENDING'::"TempVoiceDeliveryStatus",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "temp_voice_channels" AS channel
WHERE channel."controlPanelChannelId" IS NOT NULL
  AND channel."controlPanelMessageId" IS NOT NULL;
