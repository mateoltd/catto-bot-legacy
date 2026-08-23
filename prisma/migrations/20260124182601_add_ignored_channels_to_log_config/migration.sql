-- AlterTable
ALTER TABLE "log_configs" ADD COLUMN     "ignoredChannels" TEXT[] DEFAULT ARRAY[]::TEXT[];
