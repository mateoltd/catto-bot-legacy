-- CreateEnum
CREATE TYPE "TempVoiceModerationAction" AS ENUM ('AUTO_RENAME', 'BLOCK', 'WARN_ONLY');

-- CreateEnum
CREATE TYPE "KeywordApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'IGNORED');

-- AlterTable
ALTER TABLE "temp_voice_configs" ADD COLUMN     "allowListEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowedKeywords" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "customPatterns" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "moderationAction" "TempVoiceModerationAction" NOT NULL DEFAULT 'AUTO_RENAME',
ADD COLUMN     "moderationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "strictMode" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "temp_voice_moderation_logs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "finalName" TEXT,
    "isAllowed" BOOLEAN NOT NULL,
    "reasonCodes" JSONB NOT NULL DEFAULT '[]',
    "matchedPatterns" JSONB NOT NULL DEFAULT '[]',
    "heuristicScore" DOUBLE PRECISION,
    "actionTaken" TEXT NOT NULL,
    "strategyUsed" TEXT,
    "processingTimeMs" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "temp_voice_moderation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temp_voice_keyword_queue" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "normalizedKeyword" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "contextSnippet" TEXT,
    "channelId" TEXT,
    "userId" TEXT,
    "status" "KeywordApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temp_voice_keyword_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temp_voice_moderation_patterns" (
    "id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "patternType" TEXT NOT NULL,
    "description" TEXT,
    "severity" INTEGER NOT NULL DEFAULT 5,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "caseInsensitive" BOOLEAN NOT NULL DEFAULT true,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "lastMatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temp_voice_moderation_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "temp_voice_moderation_logs_guildId_createdAt_idx" ON "temp_voice_moderation_logs"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "temp_voice_moderation_logs_channelId_idx" ON "temp_voice_moderation_logs"("channelId");

-- CreateIndex
CREATE INDEX "temp_voice_moderation_logs_userId_idx" ON "temp_voice_moderation_logs"("userId");

-- CreateIndex
CREATE INDEX "temp_voice_moderation_logs_createdAt_idx" ON "temp_voice_moderation_logs"("createdAt");

-- CreateIndex
CREATE INDEX "temp_voice_keyword_queue_guildId_status_idx" ON "temp_voice_keyword_queue"("guildId", "status");

-- CreateIndex
CREATE INDEX "temp_voice_keyword_queue_status_createdAt_idx" ON "temp_voice_keyword_queue"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "temp_voice_keyword_queue_guildId_normalizedKeyword_key" ON "temp_voice_keyword_queue"("guildId", "normalizedKeyword");

-- CreateIndex
CREATE INDEX "temp_voice_moderation_patterns_enabled_patternType_idx" ON "temp_voice_moderation_patterns"("enabled", "patternType");
