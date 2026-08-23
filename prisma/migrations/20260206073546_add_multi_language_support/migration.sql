-- AlterTable
ALTER TABLE "temp_voice_configs" ADD COLUMN     "additionalLanguages" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "languageSettings" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "multiLangMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "primaryLanguage" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "temp_voice_moderation_logs" ADD COLUMN     "detectedLanguage" TEXT,
ADD COLUMN     "matchedLanguage" TEXT;

-- AlterTable
ALTER TABLE "temp_voice_moderation_patterns" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "regionalVariant" TEXT;

-- CreateIndex
CREATE INDEX "temp_voice_moderation_logs_detectedLanguage_idx" ON "temp_voice_moderation_logs"("detectedLanguage");

-- CreateIndex
CREATE INDEX "temp_voice_moderation_patterns_enabled_language_patternType_idx" ON "temp_voice_moderation_patterns"("enabled", "language", "patternType");
