/**
 * Voice XP Leaderboard Service
 */

import type {
  VoiceLeaderboardEntry,
  VoiceLeaderboardResponse,
  VoiceUserStatsResponse,
} from '../types/voice-xp.types.js';
import * as voiceXPRepository from '../repositories/voice-xp.repository.js';
import { getVoiceXPConfig } from './voice-xp-config.service.js';
import { calculateVoiceLevel } from './voice-level-calculator.service.js';
import { container } from '@sapphire/framework';

export async function getVoiceLeaderboard(
  guildId: string,
  limit: number = 10,
  offset: number = 0
): Promise<VoiceLeaderboardResponse> {
  const userXPs = await voiceXPRepository.getVoiceLeaderboard(guildId, limit, offset);
  const totalUsers = await voiceXPRepository.getVoiceUserCount(guildId);
  const config = await getVoiceXPConfig(guildId);
  const storedUsers = await container.prisma.user.findMany({
    where: { userId: { in: userXPs.map((user) => user.userId) } },
    select: { userId: true, username: true },
  });
  const storedUsernames = new Map(storedUsers.map((user) => [user.userId, user.username]));

  const entries: VoiceLeaderboardEntry[] = [];

  for (let i = 0; i < userXPs.length; i++) {
    const userXP = userXPs[i];
    if (!userXP) continue;

    const rank = offset + i + 1;

    // Try to fetch Discord user
    let username = storedUsernames.get(userXP.userId);
    let discriminator: string | null = null;
    let avatarURL: string | undefined;

    try {
      const user =
        container.client.users.cache.get(userXP.userId) ??
        (await container.client.users.fetch(userXP.userId));
      username = user.username;
      discriminator = user.discriminator;
      avatarURL = user.displayAvatarURL({ extension: 'png', size: 256 });
    } catch {
      container.logger.warn(`[Voice XP] Failed to fetch user ${userXP.userId} for leaderboard`);
    }

    if (!username) continue;

    const level = calculateVoiceLevel(config, userXP.xp).level;

    entries.push({
      rank,
      userId: userXP.userId,
      username,
      discriminator,
      avatarUrl: avatarURL ?? null,
      xp: userXP.xp,
      level,
      minutesInVoice: userXP.minutesInVoice,
    });
  }

  return {
    guildId,
    users: entries,
    total: totalUsers,
    limit,
    offset,
  };
}

export async function getVoiceUserStats(
  guildId: string,
  userId: string
): Promise<VoiceUserStatsResponse | null> {
  const config = await getVoiceXPConfig(guildId);
  const userXP = await voiceXPRepository.getUserVoiceXP(guildId, userId);

  if (!userXP) {
    return null;
  }

  const rank = await voiceXPRepository.getUserVoiceRank(guildId, userId);
  const levelCalc = calculateVoiceLevel(config, userXP.xp);

  return {
    userId,
    guildId,
    xp: userXP.xp,
    level: levelCalc.level,
    nextLevelXp: levelCalc.nextLevelXp,
    currentLevelXp: levelCalc.currentLevelXp,
    progress: levelCalc.progress,
    xpIntoLevel: levelCalc.xpIntoLevel,
    minutesInVoice: userXP.minutesInVoice,
    lastAwardAt: userXP.lastAwardAt,
    rank,
  };
}

/**
 * Get total voice XP gained in the past 7 days
 *
 * @param guildId Guild ID
 * @returns Total voice XP gained in the past week
 */
export async function getWeeklyVoiceXP(guildId: string): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return await voiceXPRepository.getVoiceXPGainedSince(guildId, sevenDaysAgo);
}

export async function getTotalVoiceXP(guildId: string): Promise<number> {
  return await voiceXPRepository.getGuildTotalVoiceXP(guildId);
}
