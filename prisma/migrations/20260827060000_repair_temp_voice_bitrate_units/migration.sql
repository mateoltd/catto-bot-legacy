-- Channel overrides and preferences use Discord bits per second. Repair both legacy kbps values
-- and values multiplied twice by workers that consumed the pre-migration Redis config cache.
UPDATE "temp_voice_channels"
SET "customBitrate" = CASE
    WHEN "customBitrate" BETWEEN 8 AND 384 THEN "customBitrate" * 1000
    WHEN "customBitrate" BETWEEN 8000000 AND 384000000 THEN "customBitrate" / 1000
    ELSE "customBitrate"
END
WHERE "customBitrate" IS NOT NULL
  AND (
      "customBitrate" BETWEEN 8 AND 384
      OR "customBitrate" BETWEEN 8000000 AND 384000000
  );

UPDATE "temp_voice_user_preferences"
SET "customBitrate" = CASE
    WHEN "customBitrate" BETWEEN 8 AND 384 THEN "customBitrate" * 1000
    WHEN "customBitrate" BETWEEN 8000000 AND 384000000 THEN "customBitrate" / 1000
    ELSE "customBitrate"
END
WHERE "customBitrate" IS NOT NULL
  AND (
      "customBitrate" BETWEEN 8 AND 384
      OR "customBitrate" BETWEEN 8000000 AND 384000000
  );

-- These DM failures are terminal for the current ownership render. A later ownership episode has
-- a different render hash and may attempt delivery again.
UPDATE "temp_voice_deliveries"
SET "status" = 'SUPERSEDED'
WHERE "kind" = 'OWNER_DM'
  AND "status" = 'FAILED'
  AND (
      "lastError" ILIKE '%cannot send messages to this user%'
      OR "lastError" ILIKE '%no mutual guilds%'
  );
