-- Search is intentionally expression-backed rather than stored in a Prisma
-- field. This keeps writes simple while allowing indexed, ranked corpus search.
CREATE INDEX IF NOT EXISTS "evidence_search_document_idx"
ON "evidence"
USING GIN (
  to_tsvector(
    'simple'::regconfig,
    COALESCE("originalFilename", '') || ' ' ||
    COALESCE("url", '') || ' ' ||
    COALESCE("description", '') || ' ' ||
    COALESCE("uploadedByTag", '')
  )
);

CREATE INDEX IF NOT EXISTS "evidence_guild_created_id_idx"
ON "evidence" ("guildId", "createdAt" DESC, "id");

CREATE INDEX IF NOT EXISTS "evidence_guild_case_created_id_idx"
ON "evidence" ("guildId", "caseNumber", "createdAt" DESC, "id");

CREATE INDEX IF NOT EXISTS "evidence_guild_type_created_id_idx"
ON "evidence" ("guildId", "type", "createdAt" DESC, "id");

CREATE INDEX IF NOT EXISTS "evidence_guild_status_created_id_idx"
ON "evidence" ("guildId", "status", "createdAt" DESC, "id");
