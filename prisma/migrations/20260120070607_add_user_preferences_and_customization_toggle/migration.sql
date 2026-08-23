-- AlterTable
ALTER TABLE "temp_voice_configs" ADD COLUMN     "allowCustomization" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "temp_voice_user_preferences" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customName" TEXT,
    "customUserLimit" INTEGER,
    "customBitrate" INTEGER,
    "customRegion" TEXT,
    "preferLocked" BOOLEAN NOT NULL DEFAULT false,
    "preferHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temp_voice_user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "temp_voice_user_preferences_guildId_idx" ON "temp_voice_user_preferences"("guildId");

-- CreateIndex
CREATE INDEX "temp_voice_user_preferences_userId_idx" ON "temp_voice_user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "temp_voice_user_preferences_guildId_userId_key" ON "temp_voice_user_preferences"("guildId", "userId");
