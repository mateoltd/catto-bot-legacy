/**
 * User XP Repository
 * Handles CRUD operations for UserXP with transaction safety
 */

import { container } from '@sapphire/framework';
import type { UserXP, XPEventLog } from '@prisma/client';
import type { XPEventType } from '../types/xp-text.types.js';

/**
 * Get user XP stats for a guild
 *
 * @param guildId Guild ID
 * @param userId User ID
 * @returns User XP stats or null if not found
 */
export async function getUserXP(guildId: string, userId: string): Promise<UserXP | null> {
  return await container.prisma.userXP.findUnique({
    where: {
      guildId_userId: {
        guildId,
        userId,
      },
    },
  });
}

/**
 * Get user XP with row lock (SELECT FOR UPDATE)
 * Use this when you need to prevent concurrent modifications
 * MUST be called within a transaction
 *
 * @param guildId Guild ID
 * @param userId User ID
 * @param tx Prisma transaction client
 * @returns User XP stats or null if not found
 */
export async function getUserXPForUpdate(
  guildId: string,
  userId: string,
  tx: Parameters<Parameters<typeof container.prisma.$transaction>[0]>[0]
): Promise<UserXP | null> {
  // Prisma doesn't have native FOR UPDATE, so we use raw SQL
  const result = await tx.$queryRaw<UserXP[]>`
		SELECT * FROM user_xp
		WHERE "guildId" = ${guildId} AND "userId" = ${userId}
		FOR UPDATE
	`;

  return result[0] ?? null;
}

/**
 * Create or update user XP
 * Uses upsert for atomic operation
 *
 * @param guildId Guild ID
 * @param userId User ID
 * @param xp XP amount
 * @param level Level
 * @param messageCount Message count
 * @param lastAwardAt Last award timestamp
 * @returns Updated user XP
 */
export async function upsertUserXP(
  guildId: string,
  userId: string,
  xp: number,
  level: number,
  messageCount: number,
  lastAwardAt: Date
): Promise<UserXP> {
  return await container.prisma.userXP.upsert({
    where: {
      guildId_userId: {
        guildId,
        userId,
      },
    },
    create: {
      guildId,
      userId,
      xp,
      level,
      messageCount,
      lastAwardAt,
    },
    update: {
      xp,
      level,
      messageCount,
      lastAwardAt,
    },
  });
}

/**
 * Award XP with transaction safety and row locking
 * This is the main method for awarding XP - prevents race conditions
 *
 * @param guildId Guild ID
 * @param userId User ID
 * @param xpGain XP to add
 * @param newLevel New level (after calculation)
 * @returns Updated user XP and whether level changed
 */
export async function awardXPSafe(
  guildId: string,
  userId: string,
  xpGain: number,
  newLevel: number
): Promise<{ userXP: UserXP; leveledUp: boolean; previousLevel: number }> {
  return await container.prisma.$transaction(async (tx) => {
    // Lock the row to prevent concurrent modifications
    const existing = await getUserXPForUpdate(guildId, userId, tx);

    const previousLevel = existing?.level ?? 0;
    const currentXP = existing?.xp ?? 0;
    const messageCount = (existing?.messageCount ?? 0) + 1;
    const newXP = currentXP + xpGain;

    // Upsert with new values
    const userXP = await tx.userXP.upsert({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      create: {
        guildId,
        userId,
        xp: newXP,
        level: newLevel,
        messageCount,
        lastAwardAt: new Date(),
      },
      update: {
        xp: newXP,
        level: newLevel,
        messageCount,
        lastAwardAt: new Date(),
      },
    });

    // Log the award event
    await tx.xPEventLog.create({
      data: {
        guildId,
        userId,
        eventType: 'AWARD',
        xpChange: xpGain,
        xpBefore: currentXP,
        xpAfter: newXP,
        levelBefore: previousLevel,
        levelAfter: newLevel,
        reason: 'message',
      },
    });

    // Log level-up if occurred
    if (newLevel > previousLevel) {
      await tx.xPEventLog.create({
        data: {
          guildId,
          userId,
          eventType: 'LEVEL_UP',
          xpChange: 0,
          xpBefore: newXP,
          xpAfter: newXP,
          levelBefore: previousLevel,
          levelAfter: newLevel,
          reason: `Level up from ${previousLevel} to ${newLevel}`,
        },
      });
    }

    return {
      userXP,
      leveledUp: newLevel > previousLevel,
      previousLevel,
    };
  });
}

/**
 * Get leaderboard for a guild
 *
 * @param guildId Guild ID
 * @param limit Number of results (default: 10, max: 100)
 * @param offset Offset for pagination (default: 0)
 * @returns Array of user XP sorted by XP descending
 */
export async function getLeaderboard(
  guildId: string,
  limit: number = 10,
  offset: number = 0
): Promise<UserXP[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  return await container.prisma.userXP.findMany({
    where: { guildId },
    orderBy: { xp: 'desc' },
    take: safeLimit,
    skip: offset,
  });
}

/**
 * Get total user count for a guild
 *
 * @param guildId Guild ID
 * @returns Total user count
 */
export async function getUserCount(guildId: string): Promise<number> {
  return await container.prisma.userXP.count({
    where: { guildId },
  });
}

/**
 * Get user rank in guild
 *
 * @param guildId Guild ID
 * @param userId User ID
 * @returns Rank (1-indexed) or null if user not found
 */
export async function getUserRank(guildId: string, userId: string): Promise<number | null> {
  const user = await getUserXP(guildId, userId);
  if (!user) return null;

  // Count users with more XP
  const higherRankCount = await container.prisma.userXP.count({
    where: {
      guildId,
      xp: {
        gt: user.xp,
      },
    },
  });

  return higherRankCount + 1;
}

/**
 * Reset user XP
 *
 * @param guildId Guild ID
 * @param userId User ID
 * @param reason Reason for reset
 */
export async function resetUserXP(guildId: string, userId: string, reason?: string): Promise<void> {
  await container.prisma.$transaction(async (tx) => {
    const existing = await tx.userXP.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
    });

    if (!existing) return;

    // Log the reset
    await tx.xPEventLog.create({
      data: {
        guildId,
        userId,
        eventType: 'RESET',
        xpChange: -existing.xp,
        xpBefore: existing.xp,
        xpAfter: 0,
        levelBefore: existing.level,
        levelAfter: 0,
        reason: reason ?? 'User reset',
      },
    });

    // Delete the record
    await tx.userXP.delete({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
    });
  });
}

/**
 * Reset all users in a guild
 *
 * @param guildId Guild ID
 * @param reason Reason for reset
 * @returns Number of users reset
 */
export async function resetGuildXP(guildId: string, reason?: string): Promise<number> {
  return await container.prisma.$transaction(async (tx) => {
    // Get all users
    const users = await tx.userXP.findMany({
      where: { guildId },
      select: { userId: true, xp: true, level: true },
    });

    // Log resets
    await tx.xPEventLog.createMany({
      data: users.map((user) => ({
        guildId,
        userId: user.userId,
        eventType: 'RESET' as XPEventType,
        xpChange: -user.xp,
        xpBefore: user.xp,
        xpAfter: 0,
        levelBefore: user.level,
        levelAfter: 0,
        reason: reason ?? 'Guild reset',
      })),
    });

    // Delete all records
    const result = await tx.userXP.deleteMany({
      where: { guildId },
    });

    return result.count;
  });
}

/**
 * Update user level (for recalculation)
 *
 * @param guildId Guild ID
 * @param userId User ID
 * @param newLevel New level
 */
export async function updateUserLevel(
  guildId: string,
  userId: string,
  newLevel: number
): Promise<void> {
  await container.prisma.userXP.update({
    where: {
      guildId_userId: {
        guildId,
        userId,
      },
    },
    data: {
      level: newLevel,
    },
  });
}

/**
 * Get all users in a guild (for recalculation)
 *
 * @param guildId Guild ID
 * @param batchSize Batch size for pagination
 * @param offset Offset for pagination
 * @returns Array of user XP
 */
export async function getAllGuildUsers(
  guildId: string,
  batchSize: number = 500,
  offset: number = 0
): Promise<UserXP[]> {
  return await container.prisma.userXP.findMany({
    where: { guildId },
    take: batchSize,
    skip: offset,
    orderBy: { xp: 'desc' },
  });
}

/**
 * Get XP event logs for a user
 *
 * @param guildId Guild ID
 * @param userId User ID
 * @param limit Limit results
 * @returns Array of XP event logs
 */
export async function getUserXPLogs(
  guildId: string,
  userId: string,
  limit: number = 50
): Promise<XPEventLog[]> {
  return await container.prisma.xPEventLog.findMany({
    where: {
      guildId,
      userId,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get total XP gained in a guild within a time period
 *
 * @param guildId Guild ID
 * @param since Start date
 * @returns Total XP gained since the given date
 */
export async function getXPGainedSince(guildId: string, since: Date): Promise<number> {
  const result = await container.prisma.xPEventLog.aggregate({
    where: {
      guildId,
      createdAt: {
        gte: since,
      },
      eventType: 'AWARD', // Only count awarded XP, not resets or manual adjustments
      xpChange: {
        gt: 0, // Only positive changes
      },
    },
    _sum: {
      xpChange: true,
    },
  });

  return result._sum.xpChange || 0;
}
