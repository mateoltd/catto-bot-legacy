-- CreateTable
CREATE TABLE "user_reputation" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "vouchesReceived" INTEGER NOT NULL DEFAULT 0,
    "vouchesGiven" INTEGER NOT NULL DEFAULT 0,
    "helpfulVouches" INTEGER NOT NULL DEFAULT 0,
    "friendlyVouches" INTEGER NOT NULL DEFAULT 0,
    "skilledVouches" INTEGER NOT NULL DEFAULT 0,
    "reliableVouches" INTEGER NOT NULL DEFAULT 0,
    "reputationTier" TEXT NOT NULL DEFAULT 'Bronze',
    "tierReachedAt" TIMESTAMP(3),
    "lastVouchGiven" TIMESTAMP(3),
    "suspiciousActivity" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decayAppliedAt" TIMESTAMP(3),
    "longestVouchStreak" INTEGER NOT NULL DEFAULT 0,
    "totalHelpfulness" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_reputation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reputation_vouches" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "giverUserId" TEXT NOT NULL,
    "receiverUserId" TEXT NOT NULL,
    "vouchType" TEXT NOT NULL,
    "reason" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "contextType" TEXT,
    "contextId" TEXT,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "validatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reputation_vouches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_reputation_guildId_idx" ON "user_reputation"("guildId");

-- CreateIndex
CREATE INDEX "user_reputation_userId_idx" ON "user_reputation"("userId");

-- CreateIndex
CREATE INDEX "user_reputation_reputationScore_idx" ON "user_reputation"("reputationScore");

-- CreateIndex
CREATE INDEX "user_reputation_reputationTier_idx" ON "user_reputation"("reputationTier");

-- CreateIndex
CREATE UNIQUE INDEX "user_reputation_guildId_userId_key" ON "user_reputation"("guildId", "userId");

-- CreateIndex
CREATE INDEX "reputation_vouches_guildId_idx" ON "reputation_vouches"("guildId");

-- CreateIndex
CREATE INDEX "reputation_vouches_giverUserId_idx" ON "reputation_vouches"("giverUserId");

-- CreateIndex
CREATE INDEX "reputation_vouches_receiverUserId_idx" ON "reputation_vouches"("receiverUserId");

-- CreateIndex
CREATE INDEX "reputation_vouches_vouchType_idx" ON "reputation_vouches"("vouchType");

-- CreateIndex
CREATE INDEX "reputation_vouches_createdAt_idx" ON "reputation_vouches"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reputation_vouches_guildId_giverUserId_receiverUserId_vouch_key" ON "reputation_vouches"("guildId", "giverUserId", "receiverUserId", "vouchType", "createdAt");

-- AddForeignKey
ALTER TABLE "reputation_vouches" ADD CONSTRAINT "reputation_vouches_guildId_giverUserId_fkey" FOREIGN KEY ("guildId", "giverUserId") REFERENCES "user_reputation"("guildId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reputation_vouches" ADD CONSTRAINT "reputation_vouches_guildId_receiverUserId_fkey" FOREIGN KEY ("guildId", "receiverUserId") REFERENCES "user_reputation"("guildId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reputation_vouches" ADD CONSTRAINT "reputation_vouches_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
