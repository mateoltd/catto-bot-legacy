-- Fix: migration 20260205155551 added watermarkDownloads with DEFAULT false,
-- but the Prisma schema specifies @default(true). Align the DB default and
-- flip existing rows that were incorrectly defaulted to false.

UPDATE "mod_configs" SET "watermarkDownloads" = true WHERE "watermarkDownloads" = false;
ALTER TABLE "mod_configs" ALTER COLUMN "watermarkDownloads" SET DEFAULT true;

-- Clean up orphaned search_vector artifacts from removed 20260205_add_evidence_search_vector
DROP TRIGGER IF EXISTS evidence_search_update ON "evidence";
DROP FUNCTION IF EXISTS evidence_search_trigger();
DROP INDEX IF EXISTS "evidence_search_vector_idx";
ALTER TABLE "evidence" DROP COLUMN IF EXISTS "search_vector";
