-- AlterTable
ALTER TABLE "temp_voice_channels" ADD COLUMN     "trustedUserIds" JSONB NOT NULL DEFAULT '[]';
