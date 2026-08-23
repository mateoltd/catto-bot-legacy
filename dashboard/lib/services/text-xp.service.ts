import { botApi } from '@/lib/api';

export interface XPConfig {
  enabled: boolean;
  cooldownSec: number;
  xpMode: 'RANDOM' | 'FIXED';
  minXp: number;
  maxXp: number;
  fixedXp: number;
  minMessageLength: number;
  maxXpPerMinute: number | null;
  allowedChannels: string[];
  ignoredChannels: string[];
  ignoredRoles: string[];
  announceLevelUp: boolean;
  announceChannelId: string | null;
  messageTemplate: string;
  embedEnabled: boolean;
  embedColor: number;
  levelCurveType: 'FORMULA' | 'TABLE';
  formulaBase: number;
  formulaExponent: number;
  formulaOffset: number;
  tableThresholds: number[];
}

export interface UserXPStats {
  userId: string;
  username?: string;
  xp: number;
  level: number;
  rank: number;
  totalMessages?: number;
  xpToNextLevel?: number;
  progressPercent?: number;
}

export interface RecalcResponse {
  success: boolean;
  message: string;
  guildId: string;
  processedUsers: number;
  updatedLevels: number;
}

export const textXPService = {
  /**
   * Get text XP configuration for a guild
   */
  async getConfig(guildId: string): Promise<{ config: XPConfig }> {
    const response = await botApi.get(`/api/guilds/${guildId}/xp/config`);
    return response.data;
  },

  /**
   * Update text XP configuration for a guild
   */
  async updateConfig(guildId: string, config: Partial<XPConfig>): Promise<{ config: XPConfig }> {
    const response = await botApi.put(`/api/guilds/${guildId}/xp/config`, config);
    return response.data;
  },

  /**
   * Get text XP leaderboard for a guild
   */
  async getLeaderboard(guildId: string, limit: number = 10) {
    const response = await botApi.get(`/api/guilds/${guildId}/xp/leaderboard`, {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get XP stats for a specific user
   */
  async getUserStats(
    guildId: string,
    userId: string
  ): Promise<{ success: boolean; stats: UserXPStats }> {
    const response = await botApi.get(`/api/guilds/${guildId}/xp/users/${userId}`);
    return response.data;
  },

  /**
   * Recalculate levels for all users based on current XP curve
   */
  async recalculateLevels(guildId: string): Promise<RecalcResponse> {
    const response = await botApi.post(`/api/guilds/${guildId}/xp/recalc`);
    return response.data;
  },

  /**
   * Reset text XP for entire guild
   */
  async resetGuild(guildId: string, reason?: string) {
    const response = await botApi.post(`/api/guilds/${guildId}/xp/reset/guild`, {
      reason,
    });
    return response.data;
  },

  /**
   * Reset text XP for a specific user
   */
  async resetUser(guildId: string, userId: string, reason?: string) {
    const response = await botApi.post(`/api/guilds/${guildId}/xp/reset/user`, {
      userId,
      reason,
    });
    return response.data;
  },
};
