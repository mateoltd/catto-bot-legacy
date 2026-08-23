/*
  Warnings:

  - The values [MUTE,UNMUTE] on the enum `ModAction` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ModAction_new" AS ENUM ('BAN', 'UNBAN', 'KICK', 'TIMEOUT', 'WARN', 'SOFTBAN', 'TEMPBAN', 'MUTE_TEXT', 'MUTE_VOICE', 'MUTE_BOTH', 'UNMUTE_TEXT', 'UNMUTE_VOICE', 'UNMUTE_BOTH');
ALTER TABLE "mod_cases" ALTER COLUMN "action" TYPE "ModAction_new" USING ("action"::text::"ModAction_new");
ALTER TABLE "case_templates" ALTER COLUMN "action" TYPE "ModAction_new" USING ("action"::text::"ModAction_new");
ALTER TYPE "ModAction" RENAME TO "ModAction_old";
ALTER TYPE "ModAction_new" RENAME TO "ModAction";
DROP TYPE "public"."ModAction_old";
COMMIT;
