-- CreateEnum
CREATE TYPE "TempVoiceNamingScheme" AS ENUM ('USERNAME', 'DISPLAYNAME', 'SEQUENTIAL', 'CUSTOM');

-- AlterTable
ALTER TABLE "temp_voice_configs" ADD COLUMN     "namingScheme" "TempVoiceNamingScheme" NOT NULL DEFAULT 'USERNAME';
