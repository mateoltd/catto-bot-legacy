-- CreateTable
CREATE TABLE "guild_xp_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownSec" INTEGER NOT NULL DEFAULT 60,
    "xpMode" TEXT NOT NULL DEFAULT 'RANDOM',
    "minXp" INTEGER NOT NULL DEFAULT 15,
    "maxXp" INTEGER NOT NULL DEFAULT 25,
    "fixedXp" INTEGER NOT NULL DEFAULT 20,
    "minMessageLength" INTEGER NOT NULL DEFAULT 5,
    "maxXpPerMinute" INTEGER,
    "allowedChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ignoredChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ignoredRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "announceLevelUp" BOOLEAN NOT NULL DEFAULT true,
    "announceChannelId" TEXT,
    "messageTemplate" TEXT NOT NULL DEFAULT '🎉 {user} reached level {level}!',
    "embedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "embedColor" INTEGER NOT NULL DEFAULT 5793266,
    "levelCurveType" TEXT NOT NULL DEFAULT 'FORMULA',
    "formulaBase" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "formulaExponent" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "formulaOffset" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "tableThresholds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_xp_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_xp" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastAwardAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_xp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_event_logs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "xpChange" INTEGER NOT NULL,
    "xpBefore" INTEGER NOT NULL,
    "xpAfter" INTEGER NOT NULL,
    "levelBefore" INTEGER NOT NULL,
    "levelAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guild_xp_configs_guildId_key" ON "guild_xp_configs"("guildId");

-- CreateIndex
CREATE INDEX "guild_xp_configs_guildId_idx" ON "guild_xp_configs"("guildId");

-- CreateIndex
CREATE INDEX "user_xp_guildId_xp_idx" ON "user_xp"("guildId", "xp" DESC);

-- CreateIndex
CREATE INDEX "user_xp_guildId_userId_idx" ON "user_xp"("guildId", "userId");

-- CreateIndex
CREATE INDEX "user_xp_lastAwardAt_idx" ON "user_xp"("lastAwardAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_xp_guildId_userId_key" ON "user_xp"("guildId", "userId");

-- CreateIndex
CREATE INDEX "xp_event_logs_guildId_userId_idx" ON "xp_event_logs"("guildId", "userId");

-- CreateIndex
CREATE INDEX "xp_event_logs_guildId_createdAt_idx" ON "xp_event_logs"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "xp_event_logs_eventType_idx" ON "xp_event_logs"("eventType");

-- AddForeignKey
ALTER TABLE "guild_xp_configs" ADD CONSTRAINT "guild_xp_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_xp" ADD CONSTRAINT "user_xp_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_event_logs" ADD CONSTRAINT "xp_event_logs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
