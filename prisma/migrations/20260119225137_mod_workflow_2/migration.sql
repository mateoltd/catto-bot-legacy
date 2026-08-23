-- CreateEnum
CREATE TYPE "MuteType" AS ENUM ('TEXT', 'VOICE', 'BOTH');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ModAction" ADD VALUE 'MUTE_TEXT';
ALTER TYPE "ModAction" ADD VALUE 'MUTE_VOICE';
ALTER TYPE "ModAction" ADD VALUE 'MUTE_BOTH';
ALTER TYPE "ModAction" ADD VALUE 'UNMUTE_TEXT';
ALTER TYPE "ModAction" ADD VALUE 'UNMUTE_VOICE';
ALTER TYPE "ModAction" ADD VALUE 'UNMUTE_BOTH';

-- AlterTable
ALTER TABLE "mod_configs" ADD COLUMN     "muteSettings" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "mutedTextRole" TEXT,
ADD COLUMN     "mutedVoiceRole" TEXT,
ADD COLUMN     "warningEscalation" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "mutes" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" "MuteType" NOT NULL,
    "reason" TEXT NOT NULL,
    "duration" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "mutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_flags" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_templates" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "action" "ModAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "duration" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_queue" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reportedById" TEXT,
    "reason" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "claimedById" TEXT,
    "claimedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_events" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetType" TEXT,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "success" BOOLEAN NOT NULL,
    "errorType" TEXT,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "caseId" TEXT,
    "caseNumber" INTEGER,
    "correlationId" TEXT,

    CONSTRAINT "mod_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mutes_guildId_active_idx" ON "mutes"("guildId", "active");

-- CreateIndex
CREATE INDEX "mutes_expiresAt_idx" ON "mutes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "mutes_guildId_userId_type_key" ON "mutes"("guildId", "userId", "type");

-- CreateIndex
CREATE INDEX "user_flags_guildId_active_idx" ON "user_flags"("guildId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "user_flags_guildId_userId_flag_key" ON "user_flags"("guildId", "userId", "flag");

-- CreateIndex
CREATE INDEX "case_templates_guildId_idx" ON "case_templates"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "case_templates_guildId_name_key" ON "case_templates"("guildId", "name");

-- CreateIndex
CREATE INDEX "moderation_queue_guildId_status_idx" ON "moderation_queue"("guildId", "status");

-- CreateIndex
CREATE INDEX "moderation_queue_priority_idx" ON "moderation_queue"("priority");

-- CreateIndex
CREATE INDEX "mod_events_guildId_timestamp_idx" ON "mod_events"("guildId", "timestamp");

-- CreateIndex
CREATE INDEX "mod_events_action_idx" ON "mod_events"("action");

-- CreateIndex
CREATE INDEX "mod_events_actorId_idx" ON "mod_events"("actorId");

-- CreateIndex
CREATE INDEX "mod_events_targetId_idx" ON "mod_events"("targetId");
