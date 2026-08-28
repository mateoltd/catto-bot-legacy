CREATE TABLE "vanity_configs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "keyword" TEXT NOT NULL DEFAULT '',
    "roleId" TEXT,
    "thankYouEnabled" BOOLEAN NOT NULL DEFAULT false,
    "thankYouChannelId" TEXT,
    "thankYouMessage" TEXT NOT NULL DEFAULT 'Thanks {user} for supporting the server! You received {role}.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vanity_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vanity_configs_guildId_key" ON "vanity_configs"("guildId");

ALTER TABLE "vanity_configs"
ADD CONSTRAINT "vanity_configs_guildId_fkey"
FOREIGN KEY ("guildId") REFERENCES "guilds"("guildId")
ON DELETE CASCADE ON UPDATE CASCADE;
