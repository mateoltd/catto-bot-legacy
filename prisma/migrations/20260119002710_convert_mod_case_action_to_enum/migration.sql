/*
  Warnings:

  - Changed the type of `action` on the `mod_cases` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ModAction" AS ENUM ('BAN', 'UNBAN', 'KICK', 'TIMEOUT', 'WARN', 'MUTE', 'UNMUTE', 'SOFTBAN', 'TEMPBAN');

-- AlterTable
ALTER TABLE "mod_cases" DROP COLUMN "action",
ADD COLUMN     "action" "ModAction" NOT NULL;

-- CreateIndex
CREATE INDEX "mod_cases_action_idx" ON "mod_cases"("action");
