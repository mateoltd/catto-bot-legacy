-- CreateTable
CREATE TABLE "guild_voice_xp_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "xpPerMinute" INTEGER NOT NULL DEFAULT 5,
    "minSessionMinutes" INTEGER NOT NULL DEFAULT 1,
    "xpMode" TEXT NOT NULL DEFAULT 'PER_MINUTE',
    "allowedChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ignoredChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "awardMuted" BOOLEAN NOT NULL DEFAULT false,
    "awardDeafened" BOOLEAN NOT NULL DEFAULT false,
    "awardStreaming" BOOLEAN NOT NULL DEFAULT true,
    "awardVideo" BOOLEAN NOT NULL DEFAULT true,
    "ignoreAfkChannel" BOOLEAN NOT NULL DEFAULT true,
    "ignoredRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "announceLevelUp" BOOLEAN NOT NULL DEFAULT true,
    "announceChannelId" TEXT,
    "messageTemplate" TEXT NOT NULL DEFAULT '🎤 {user} reached voice level {level}!',
    "embedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "embedColor" INTEGER NOT NULL DEFAULT 5814783,
    "levelCurveType" TEXT NOT NULL DEFAULT 'FORMULA',
    "formulaBase" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "formulaExponent" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "formulaOffset" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "tableThresholds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],

    CONSTRAINT "guild_voice_xp_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_voice_xp" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "minutesInVoice" INTEGER NOT NULL DEFAULT 0,
    "lastAwardAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_voice_xp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_sessions" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,
    "wasMuted" BOOLEAN NOT NULL DEFAULT false,
    "wasDeafened" BOOLEAN NOT NULL DEFAULT false,
    "wasStreaming" BOOLEAN NOT NULL DEFAULT false,
    "wasVideo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "voice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_xp_event_logs" (
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

    CONSTRAINT "voice_xp_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guild_voice_xp_configs_guildId_key" ON "guild_voice_xp_configs"("guildId");

-- CreateIndex
CREATE INDEX "guild_voice_xp_configs_guildId_idx" ON "guild_voice_xp_configs"("guildId");

-- CreateIndex
CREATE INDEX "user_voice_xp_guildId_xp_idx" ON "user_voice_xp"("guildId", "xp" DESC);

-- CreateIndex
CREATE INDEX "user_voice_xp_guildId_userId_idx" ON "user_voice_xp"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_voice_xp_guildId_userId_key" ON "user_voice_xp"("guildId", "userId");

-- CreateIndex
CREATE INDEX "voice_sessions_guildId_userId_idx" ON "voice_sessions"("guildId", "userId");

-- CreateIndex
CREATE INDEX "voice_sessions_guildId_userId_leftAt_idx" ON "voice_sessions"("guildId", "userId", "leftAt");

-- CreateIndex
CREATE INDEX "voice_sessions_joinedAt_idx" ON "voice_sessions"("joinedAt");

-- CreateIndex
CREATE INDEX "voice_xp_event_logs_guildId_userId_idx" ON "voice_xp_event_logs"("guildId", "userId");

-- CreateIndex
CREATE INDEX "voice_xp_event_logs_guildId_createdAt_idx" ON "voice_xp_event_logs"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "voice_xp_event_logs_eventType_idx" ON "voice_xp_event_logs"("eventType");

-- AddForeignKey
ALTER TABLE "guild_voice_xp_configs" ADD CONSTRAINT "guild_voice_xp_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_voice_xp" ADD CONSTRAINT "user_voice_xp_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_xp_event_logs" ADD CONSTRAINT "voice_xp_event_logs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
