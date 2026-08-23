-- CreateTable
CREATE TABLE "level_rewards" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "xpType" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "rewardData" JSONB NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "oneTime" BOOLEAN NOT NULL DEFAULT true,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "requiresPrevious" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "level_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reward_claims" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "levelAtClaim" INTEGER NOT NULL,
    "xpAtClaim" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "revokeReason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "user_reward_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "template" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "level_rewards_guildId_idx" ON "level_rewards"("guildId");

-- CreateIndex
CREATE INDEX "level_rewards_guildId_level_xpType_idx" ON "level_rewards"("guildId", "level", "xpType");

-- CreateIndex
CREATE INDEX "level_rewards_enabled_idx" ON "level_rewards"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "level_rewards_guildId_level_xpType_rewardType_name_key" ON "level_rewards"("guildId", "level", "xpType", "rewardType", "name");

-- CreateIndex
CREATE INDEX "user_reward_claims_guildId_userId_idx" ON "user_reward_claims"("guildId", "userId");

-- CreateIndex
CREATE INDEX "user_reward_claims_rewardId_idx" ON "user_reward_claims"("rewardId");

-- CreateIndex
CREATE INDEX "user_reward_claims_status_idx" ON "user_reward_claims"("status");

-- CreateIndex
CREATE INDEX "user_reward_claims_expiresAt_idx" ON "user_reward_claims"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_reward_claims_guildId_userId_rewardId_key" ON "user_reward_claims"("guildId", "userId", "rewardId");

-- CreateIndex
CREATE INDEX "reward_templates_category_idx" ON "reward_templates"("category");

-- CreateIndex
CREATE INDEX "reward_templates_isPublic_idx" ON "reward_templates"("isPublic");

-- AddForeignKey
ALTER TABLE "user_reward_claims" ADD CONSTRAINT "user_reward_claims_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "level_rewards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
