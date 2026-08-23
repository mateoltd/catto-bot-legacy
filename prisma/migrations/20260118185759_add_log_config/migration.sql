-- CreateTable
CREATE TABLE "log_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "categoryId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "messagesWebhook" TEXT,
    "voiceWebhook" TEXT,
    "voiceStateWebhook" TEXT,
    "ticketsWebhook" TEXT,
    "transcriptsWebhook" TEXT,
    "rolesWebhook" TEXT,
    "channelsWebhook" TEXT,
    "membersWebhook" TEXT,
    "stageWebhook" TEXT,
    "eventsWebhook" TEXT,
    "pollsWebhook" TEXT,
    "emojisWebhook" TEXT,
    "stickersWebhook" TEXT,
    "webhooksWebhook" TEXT,
    "joinsWebhook" TEXT,
    "leavesWebhook" TEXT,
    "serverWebhook" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "log_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "log_configs_guildId_key" ON "log_configs"("guildId");

-- CreateIndex
CREATE INDEX "log_configs_guildId_idx" ON "log_configs"("guildId");

-- AddForeignKey
ALTER TABLE "log_configs" ADD CONSTRAINT "log_configs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
