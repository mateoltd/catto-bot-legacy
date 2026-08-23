-- AlterTable
ALTER TABLE "evidence" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "mod_configs" ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "case_notes" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorTag" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_notes_caseId_idx" ON "case_notes"("caseId");

-- CreateIndex
CREATE INDEX "case_notes_guildId_idx" ON "case_notes"("guildId");

-- CreateIndex
CREATE INDEX "case_notes_createdAt_idx" ON "case_notes"("createdAt");

-- CreateIndex
CREATE INDEX "evidence_tags_idx" ON "evidence"("tags");

-- AddForeignKey
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "mod_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
