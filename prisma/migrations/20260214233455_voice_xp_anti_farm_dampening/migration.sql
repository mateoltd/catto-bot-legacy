-- AlterTable
ALTER TABLE "guild_voice_xp_configs" ADD COLUMN     "antiFarmDampeningEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "antiFarmDampeningMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
ADD COLUMN     "antiFarmMinimumParticipants" INTEGER NOT NULL DEFAULT 2;
