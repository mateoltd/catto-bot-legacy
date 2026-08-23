/**
 * XP Leaderboard Service
 * Handles leaderboard queries and user stats
 */

import type { UserXP } from '@prisma/client';
import type {
  LeaderboardResponse,
  LeaderboardEntry,
  UserStatsResponse,
} from '../types/xp-text.types.js';
import * as xpRepo from '../repositories/xp-text.repository.js';
import * as levelService from './xp-text-level.service.js';
import { container } from '@sapphire/framework';

/**
 * Get leaderboard for a guild
 *
 * @param guildId Guild ID
 * @param limit Number of results (max: 100)
 * @param offset Offset for pagination
 * @returns Leaderboard response with user entries
 */
export async function getLeaderboard(
  guildId: string,
  limit: number = 10,
  offset: number = 0
): Promise<LeaderboardResponse> {
  // Get users from database
  const users = await xpRepo.getLeaderboard(guildId, limit, offset);
  const total = await xpRepo.getUserCount(guildId);

  // Fetch user data from Discord
  const entries: LeaderboardEntry[] = [];

  for (let i = 0; i < users.length; i++) {
    const userXP = users[i];
    if (!userXP) continue;

    // Try to fetch user from Discord
    let username = 'Unknown User';
    let discriminator = '0000';
    let avatarUrl: string | null = null;

    try {
      const discordUser = await container.client.users.fetch(userXP.userId);
      username = discordUser.username;
      discriminator = discordUser.discriminator;
      avatarUrl = discordUser.displayAvatarURL({ extension: 'png', size: 256 });
    } catch {
      // User not found or inaccessible, use defaults
      container.logger.debug(`Failed to fetch user ${userXP.userId} for leaderboard`);
    }

    entries.push({
      userId: userXP.userId,
      username,
      discriminator,
      avatarUrl,
      xp: userXP.xp,
      level: userXP.level,
      messageCount: userXP.messageCount,
      rank: offset + i + 1,
    });
  }

  return {
    guildId,
    users: entries,
    total,
    limit,
    offset,
  };
}

/**
 * Get user stats for a guild
 *
 * @param guildId Guild ID
 * @param userId User ID
 * @returns User stats response or null if not found
 */
export async function getUserStats(
  guildId: string,
  userId: string
): Promise<UserStatsResponse | null> {
  const userXP = await xpRepo.getUserXP(guildId, userId);
  if (!userXP) return null;

  // Calculate level details
  const levelCalc = await levelService.calculateLevelForGuild(guildId, userXP.xp);

  // Get user rank
  const rank = await xpRepo.getUserRank(guildId, userId);

  return {
    userId: userXP.userId,
    guildId: userXP.guildId,
    xp: userXP.xp,
    level: userXP.level,
    nextLevelXp: levelCalc.nextLevelXp,
    currentLevelXp: levelCalc.currentLevelXp,
    progress: levelCalc.progress,
    xpIntoLevel: levelCalc.xpIntoLevel,
    messageCount: userXP.messageCount,
    lastAwardAt: userXP.lastAwardAt,
    rank,
  };
}

/**
 * Get top users in a guild by XP
 * Simplified version without Discord user fetching
 *
 * @param guildId Guild ID
 * @param limit Number of results
 * @returns Array of user XP
 */
export async function getTopUsers(guildId: string, limit: number = 10): Promise<UserXP[]> {
  return await xpRepo.getLeaderboard(guildId, limit, 0);
}

/**
 * Get user's rank in guild
 *
 * @param guildId Guild ID
 * @param userId User ID
 * @returns Rank (1-indexed) or null if not found
 */
export async function getUserRank(guildId: string, userId: string): Promise<number | null> {
  return await xpRepo.getUserRank(guildId, userId);
}

/**
 * Get total user count in guild
 *
 * @param guildId Guild ID
 * @returns Total user count
 */
export async function getTotalUsers(guildId: string): Promise<number> {
  return await xpRepo.getUserCount(guildId);
}

/**
 * Get users around a specific rank
 * Useful for showing context around a user's position
 *
 * @param guildId Guild ID
 * @param rank Target rank (1-indexed)
 * @param radius Number of users above and below
 * @returns Leaderboard response
 */
export async function getUsersAroundRank(
  guildId: string,
  rank: number,
  radius: number = 5
): Promise<LeaderboardResponse> {
  const offset = Math.max(0, rank - radius - 1);
  const limit = radius * 2 + 1;

  return await getLeaderboard(guildId, limit, offset);
}

/**
 * Check if user is in top N
 *
 * @param guildId Guild ID
 * @param userId User ID
 * @param topN Top N positions to check
 * @returns True if user is in top N
 */
export async function isInTop(guildId: string, userId: string, topN: number): Promise<boolean> {
  const rank = await getUserRank(guildId, userId);
  if (!rank) return false;

  return rank <= topN;
}

/**
 * Get leaderboard page
 * Helper for paginated leaderboard display
 *
 * @param guildId Guild ID
 * @param page Page number (1-indexed)
 * @param pageSize Items per page
 * @returns Leaderboard response
 */
export async function getLeaderboardPage(
  guildId: string,
  page: number = 1,
  pageSize: number = 10
): Promise<LeaderboardResponse> {
  const offset = (page - 1) * pageSize;
  return await getLeaderboard(guildId, pageSize, offset);
}

/**
 * Get total XP gained in the past 7 days
 *
 * @param guildId Guild ID
 * @returns Total XP gained in the past week
 */
export async function getWeeklyXP(guildId: string): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return await xpRepo.getXPGainedSince(guildId, sevenDaysAgo);
}
