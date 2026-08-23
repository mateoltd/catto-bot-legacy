-- AlterTable
ALTER TABLE "mod_cases" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "assignedToTag" TEXT;

-- AlterTable
ALTER TABLE "mod_configs" ADD COLUMN     "watermarkDownloads" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "watermarkText" TEXT;

-- CreateTable
CREATE TABLE "evidence_access_logs" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userTag" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evidence_access_logs_evidenceId_idx" ON "evidence_access_logs"("evidenceId");

-- CreateIndex
CREATE INDEX "evidence_access_logs_guildId_idx" ON "evidence_access_logs"("guildId");

-- CreateIndex
CREATE INDEX "evidence_access_logs_createdAt_idx" ON "evidence_access_logs"("createdAt");

-- CreateIndex
CREATE INDEX "mod_cases_assignedToId_idx" ON "mod_cases"("assignedToId");

-- AddForeignKey
ALTER TABLE "evidence_access_logs" ADD CONSTRAINT "evidence_access_logs_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
