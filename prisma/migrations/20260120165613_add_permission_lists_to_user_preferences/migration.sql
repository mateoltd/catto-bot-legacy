-- AlterTable
ALTER TABLE "temp_voice_user_preferences" ADD COLUMN     "allowedUserIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "deniedUserIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "trustedUserIds" JSONB NOT NULL DEFAULT '[]';
