-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'URL', 'DISCORD_URL', 'MESSAGE_SNAPSHOT');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('PENDING', 'PROCESSING', 'VERIFIED', 'FLAGGED', 'REJECTED');

-- AlterEnum
ALTER TYPE "PermissionResourceType" ADD VALUE 'RESOURCE';

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "caseNumber" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedByTag" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT,
    "storageBucket" TEXT,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "contentHash" TEXT,
    "hmacSignature" TEXT,
    "url" TEXT,
    "snapshotId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_amendments" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "amendedById" TEXT NOT NULL,
    "amendedByTag" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_snapshots" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "capturedById" TEXT NOT NULL,
    "capturedByTag" TEXT NOT NULL,
    "firstMessageId" TEXT NOT NULL,
    "lastMessageId" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 1,
    "snapshotData" JSONB NOT NULL,
    "mediaStorageKeys" JSONB,
    "contentHash" TEXT NOT NULL,
    "hmacSignature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evidence_guildId_idx" ON "evidence"("guildId");

-- CreateIndex
CREATE INDEX "evidence_caseId_idx" ON "evidence"("caseId");

-- CreateIndex
CREATE INDEX "evidence_caseNumber_guildId_idx" ON "evidence"("caseNumber", "guildId");

-- CreateIndex
CREATE INDEX "evidence_uploadedById_idx" ON "evidence"("uploadedById");

-- CreateIndex
CREATE INDEX "evidence_type_idx" ON "evidence"("type");

-- CreateIndex
CREATE INDEX "evidence_status_idx" ON "evidence"("status");

-- CreateIndex
CREATE INDEX "evidence_createdAt_idx" ON "evidence"("createdAt");

-- CreateIndex
CREATE INDEX "evidence_amendments_evidenceId_idx" ON "evidence_amendments"("evidenceId");

-- CreateIndex
CREATE INDEX "evidence_amendments_amendedById_idx" ON "evidence_amendments"("amendedById");

-- CreateIndex
CREATE INDEX "evidence_amendments_createdAt_idx" ON "evidence_amendments"("createdAt");

-- CreateIndex
CREATE INDEX "message_snapshots_guildId_idx" ON "message_snapshots"("guildId");

-- CreateIndex
CREATE INDEX "message_snapshots_channelId_idx" ON "message_snapshots"("channelId");

-- CreateIndex
CREATE INDEX "message_snapshots_capturedById_idx" ON "message_snapshots"("capturedById");

-- CreateIndex
CREATE INDEX "message_snapshots_firstMessageId_idx" ON "message_snapshots"("firstMessageId");

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "mod_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "message_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_amendments" ADD CONSTRAINT "evidence_amendments_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_snapshots" ADD CONSTRAINT "message_snapshots_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
