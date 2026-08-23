-- CreateTable
CREATE TABLE "temp_voice_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "joinToCreateChannels" JSONB NOT NULL DEFAULT '[]',
    "categoryId" TEXT,
    "fallbackCategoryId" TEXT,
    "defaultNameTemplate" TEXT NOT NULL DEFAULT '{username}''s Channel',
    "defaultUserLimit" INTEGER NOT NULL DEFAULT 0,
    "defaultBitrate" INTEGER,
    "defaultRegion" TEXT,
    "defaultLocked" BOOLEAN NOT NULL DEFAULT false,
    "defaultHidden" BOOLEAN NOT NULL DEFAULT false,
    "deleteDelaySeconds" INTEGER NOT NULL DEFAULT 5,
    "ownerLeaveStrategy" TEXT NOT NULL DEFAULT 'TRANSFER',
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 10,
    "maxChannelsPerUser" INTEGER NOT NULL DEFAULT 3,
    "controlPanelEnabled" BOOLEAN NOT NULL DEFAULT true,
    "controlPanelOnCreate" BOOLEAN NOT NULL DEFAULT true,
    "logChannelId" TEXT,
    "adminRoleIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temp_voice_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temp_voice_channels" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
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
    "deletionScheduledAt" TIMESTAMP(3),
    "controlPanelMessageId" TEXT,
    "controlPanelChannelId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temp_voice_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "temp_voice_configs_guildId_key" ON "temp_voice_configs"("guildId");

-- CreateIndex
CREATE INDEX "temp_voice_configs_guildId_idx" ON "temp_voice_configs"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "temp_voice_channels_channelId_key" ON "temp_voice_channels"("channelId");

-- CreateIndex
CREATE INDEX "temp_voice_channels_guildId_idx" ON "temp_voice_channels"("guildId");

-- CreateIndex
CREATE INDEX "temp_voice_channels_ownerId_idx" ON "temp_voice_channels"("ownerId");

-- CreateIndex
CREATE INDEX "temp_voice_channels_channelId_idx" ON "temp_voice_channels"("channelId");

-- CreateIndex
CREATE INDEX "temp_voice_channels_deletionScheduledAt_idx" ON "temp_voice_channels"("deletionScheduledAt");
