/*
  Warnings:

  - Added the required column `updatedAt` to the `mod_cases` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'CLOSED', 'VOID');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- AlterTable
ALTER TABLE "mod_cases" ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "user_mod_notes" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_mod_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_appeals" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "caseId" TEXT,
    "createdById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "resolution" TEXT,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "mod_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_tasks" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "data" JSONB,
    "executeAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_mod_notes_guildId_idx" ON "user_mod_notes"("guildId");

-- CreateIndex
CREATE INDEX "user_mod_notes_userId_idx" ON "user_mod_notes"("userId");

-- CreateIndex
CREATE INDEX "user_mod_notes_guildId_userId_idx" ON "user_mod_notes"("guildId", "userId");

-- CreateIndex
CREATE INDEX "user_mod_notes_createdById_idx" ON "user_mod_notes"("createdById");

-- CreateIndex
CREATE INDEX "mod_appeals_guildId_idx" ON "mod_appeals"("guildId");

-- CreateIndex
CREATE INDEX "mod_appeals_targetId_idx" ON "mod_appeals"("targetId");

-- CreateIndex
CREATE INDEX "mod_appeals_status_idx" ON "mod_appeals"("status");

-- CreateIndex
CREATE INDEX "mod_appeals_guildId_status_idx" ON "mod_appeals"("guildId", "status");

-- CreateIndex
CREATE INDEX "scheduled_tasks_type_idx" ON "scheduled_tasks"("type");

-- CreateIndex
CREATE INDEX "scheduled_tasks_executeAt_idx" ON "scheduled_tasks"("executeAt");

-- CreateIndex
CREATE INDEX "scheduled_tasks_processed_executeAt_idx" ON "scheduled_tasks"("processed", "executeAt");

-- CreateIndex
CREATE INDEX "mod_cases_status_idx" ON "mod_cases"("status");
