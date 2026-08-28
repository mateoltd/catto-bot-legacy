/**
 * Voice XP User Repository
 */

import { container } from '@sapphire/framework';
import type { UserVoiceXP, Prisma } from '@prisma/client';

export async function getUserVoiceXP(guildId: string, userId: string): Promise<UserVoiceXP | null> {
  return await container.prisma.userVoiceXP.findUnique({
    where: {
      guildId_userId: { guildId, userId },
    },
  });
}

export async function getUserVoiceXPForUpdate(
  guildId: string,
  userId: string,
  tx: Prisma.TransactionClient
): Promise<UserVoiceXP | null> {
  const result = await tx.$queryRaw<UserVoiceXP[]>`
		SELECT * FROM user_voice_xp
		WHERE "guildId" = ${guildId} AND "userId" = ${userId}
		FOR UPDATE
	`;
  return result[0] ?? null;
}

export async function awardVoiceXPSafe(
  guildId: string,
  userId: string,
  xpGain: number,
  newLevel: number,
  minutesGained: number,
  metadata?: {
    channelId?: string;
    channelName?: string;
    wasStreaming?: boolean;
    wasVideo?: boolean;
    sessionId?: string;
  }
): Promise<{ userXP: UserVoiceXP; leveledUp: boolean; previousLevel: number }> {
  return await container.prisma.$transaction(async (tx) => {
    const existing = await getUserVoiceXPForUpdate(guildId, userId, tx);

    const currentXP = existing?.xp ?? 0;
    const currentLevel = existing?.level ?? 0;
    const currentMinutes = existing?.minutesInVoice ?? 0;
    const newXP = currentXP + xpGain;
    const leveledUp = newLevel > currentLevel;

    const userXP = await tx.userVoiceXP.upsert({
      where: {
        guildId_userId: { guildId, userId },
      },
      update: {
        xp: newXP,
        level: newLevel,
        minutesInVoice: currentMinutes + minutesGained,
        lastAwardAt: new Date(),
      },
      create: {
        guildId,
        userId,
        xp: newXP,
        level: newLevel,
        minutesInVoice: minutesGained,
        lastAwardAt: new Date(),
      },
    });

    // Log AWARD event
    await tx.voiceXPEventLog.create({
      data: {
        guildId,
        userId,
        eventType: 'AWARD',
        xpChange: xpGain,
        xpBefore: currentXP,
        xpAfter: newXP,
        levelBefore: currentLevel,
        levelAfter: newLevel,
        reason: 'voice_session',
        metadata: {
          minutesGained,
          ...metadata,
        },
      },
    });

    // Log LEVEL_UP event if applicable
    if (leveledUp) {
      await tx.voiceXPEventLog.create({
        data: {
          guildId,
          userId,
          eventType: 'LEVEL_UP',
          xpChange: 0,
          xpBefore: newXP,
          xpAfter: newXP,
          levelBefore: currentLevel,
          levelAfter: newLevel,
          reason: 'level_up',
        },
      });
    }

    return { userXP, leveledUp, previousLevel: currentLevel };
  });
}

export async function getVoiceLeaderboard(
  guildId: string,
  limit: number = 10,
  offset: number = 0
): Promise<UserVoiceXP[]> {
  return await container.prisma.userVoiceXP.findMany({
    where: { guildId },
    orderBy: { xp: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function getUserVoiceRank(guildId: string, userId: string): Promise<number | null> {
  const userXP = await getUserVoiceXP(guildId, userId);
  if (!userXP) return null;

  const rank = await container.prisma.userVoiceXP.count({
    where: {
      guildId,
      xp: { gt: userXP.xp },
    },
  });

  return rank + 1;
}

export async function getVoiceUserCount(guildId: string): Promise<number> {
  return await container.prisma.userVoiceXP.count({
    where: { guildId },
  });
}

export async function getGuildTotalVoiceXP(guildId: string): Promise<number> {
  const result = await container.prisma.userVoiceXP.aggregate({
    where: { guildId },
    _sum: { xp: true },
  });
  return result._sum.xp ?? 0;
}

export async function resetUserVoiceXP(
  guildId: string,
  userId: string,
  reason?: string
): Promise<void> {
  const userXP = await getUserVoiceXP(guildId, userId);
  if (!userXP) return;

  await container.prisma.$transaction(async (tx) => {
    await tx.userVoiceXP.update({
      where: {
        guildId_userId: { guildId, userId },
      },
      data: {
        xp: 0,
        level: 0,
        minutesInVoice: 0,
      },
    });

    await tx.voiceXPEventLog.create({
      data: {
        guildId,
        userId,
        eventType: 'RESET',
        xpChange: -userXP.xp,
        xpBefore: userXP.xp,
        xpAfter: 0,
        levelBefore: userXP.level,
        levelAfter: 0,
        reason,
      },
    });
  });
}

export async function resetGuildVoiceXP(guildId: string, reason?: string): Promise<number> {
  const users = await container.prisma.userVoiceXP.findMany({
    where: { guildId },
  });

  await container.prisma.$transaction(async (tx) => {
    await tx.userVoiceXP.updateMany({
      where: { guildId },
      data: {
        xp: 0,
        level: 0,
        minutesInVoice: 0,
      },
    });

    for (const user of users) {
      await tx.voiceXPEventLog.create({
        data: {
          guildId,
          userId: user.userId,
          eventType: 'RESET',
          xpChange: -user.xp,
          xpBefore: user.xp,
          xpAfter: 0,
          levelBefore: user.level,
          levelAfter: 0,
          reason,
        },
      });
    }
  });

  return users.length;
}

export async function updateUserVoiceLevel(
  guildId: string,
  userId: string,
  newLevel: number
): Promise<void> {
  await container.prisma.userVoiceXP.update({
    where: {
      guildId_userId: { guildId, userId },
    },
    data: { level: newLevel },
  });
}

export async function getAllGuildVoiceUsers(
  guildId: string,
  batchSize: number = 500,
  offset: number = 0
): Promise<UserVoiceXP[]> {
  return await container.prisma.userVoiceXP.findMany({
    where: { guildId },
    take: batchSize,
    skip: offset,
  });
}

/**
 * Get total voice XP gained in a guild within a time period
 *
 * @param guildId Guild ID
 * @param since Start date
 * @returns Total XP gained since the given date
 */
export async function getVoiceXPGainedSince(guildId: string, since: Date): Promise<number> {
  const result = await container.prisma.voiceXPEventLog.aggregate({
    where: {
      guildId,
      createdAt: {
        gte: since,
      },
      eventType: 'AWARD', // Only count awarded XP
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
