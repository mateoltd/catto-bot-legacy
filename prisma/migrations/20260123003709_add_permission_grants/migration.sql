-- CreateEnum
CREATE TYPE "PermissionSubjectType" AS ENUM ('USER', 'ROLE');

-- CreateEnum
CREATE TYPE "PermissionResourceType" AS ENUM ('COMMAND', 'CATEGORY');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateTable
CREATE TABLE "permission_grants" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "subjectType" "PermissionSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "resourceType" "PermissionResourceType" NOT NULL,
    "resourceKey" TEXT NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "permission_grants_guildId_idx" ON "permission_grants"("guildId");

-- CreateIndex
CREATE INDEX "permission_grants_guildId_subjectType_subjectId_idx" ON "permission_grants"("guildId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "permission_grants_guildId_resourceType_resourceKey_idx" ON "permission_grants"("guildId", "resourceType", "resourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "permission_grants_guildId_subjectType_subjectId_resourceTyp_key" ON "permission_grants"("guildId", "subjectType", "subjectId", "resourceType", "resourceKey");
