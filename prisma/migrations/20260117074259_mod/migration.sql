-- AlterTable
ALTER TABLE "guilds" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en-US';

-- CreateTable
CREATE TABLE "mod_cases" (
    "id" TEXT NOT NULL,
    "caseNumber" INTEGER NOT NULL,
    "guildId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetTag" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "moderatorTag" TEXT NOT NULL,
    "reason" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "mod_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mod_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "modLogChannelId" TEXT,
    "muteRoleId" TEXT,
    "autoModEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mod_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mod_cases_guildId_idx" ON "mod_cases"("guildId");

-- CreateIndex
CREATE INDEX "mod_cases_targetId_idx" ON "mod_cases"("targetId");

-- CreateIndex
CREATE INDEX "mod_cases_moderatorId_idx" ON "mod_cases"("moderatorId");

-- CreateIndex
CREATE INDEX "mod_cases_action_idx" ON "mod_cases"("action");

-- CreateIndex
CREATE INDEX "mod_cases_createdAt_idx" ON "mod_cases"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "mod_cases_guildId_caseNumber_key" ON "mod_cases"("guildId", "caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "mod_configs_guildId_key" ON "mod_configs"("guildId");

-- CreateIndex
CREATE INDEX "mod_configs_guildId_idx" ON "mod_configs"("guildId");

-- AddForeignKey
ALTER TABLE "mod_cases" ADD CONSTRAINT "mod_cases_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_configs" ADD CONSTRAINT "mod_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
