import { botApi } from '@/lib/api';

export interface VoiceXPConfig {
  enabled: boolean;
  xpPerMinute: number;
  minSessionMinutes: number;
  xpMode: 'PER_MINUTE' | 'PER_SESSION';

  // Channel Filters
  allowedChannels: string[];
  ignoredChannels: string[];

  // User State Filters
  awardMuted: boolean;
  awardDeafened: boolean;
  awardStreaming: boolean;
  awardVideo: boolean;
  ignoreAfkChannel: boolean;
  antiFarmDampeningEnabled: boolean;
  antiFarmDampeningMultiplier: number;
  antiFarmMinimumParticipants: number;

  // Role Filters
  ignoredRoles: string[];

  // Level-Up Announcements
  announceLevelUp: boolean;
  announceChannelId: string | null;
  messageTemplate: string;
  embedEnabled: boolean;
  embedColor: number;

  // Level Curve Configuration
  levelCurveType: 'FORMULA' | 'TABLE';
  formulaBase: number;
  formulaExponent: number;
  formulaOffset: number;
  tableThresholds: number[];
}

export const voiceXPService = {
  /**
   * Get voice XP configuration for a guild
   */
  async getConfig(guildId: string): Promise<VoiceXPConfig> {
    const response = await botApi.get(`/api/guilds/${guildId}/voice-xp/config`);
    return response.data;
  },

  /**
   * Update voice XP configuration for a guild
   */
  async updateConfig(guildId: string, config: Partial<VoiceXPConfig>): Promise<VoiceXPConfig> {
    const response = await botApi.put(`/api/guilds/${guildId}/voice-xp/config`, config);
    return response.data;
  },

  /**
   * Get voice XP leaderboard for a guild
   */
  async getLeaderboard(guildId: string, limit: number = 10) {
    const response = await botApi.get(`/api/guilds/${guildId}/voice-xp/leaderboard`, {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get voice XP stats for a guild
   */
  async getStats(guildId: string) {
    const response = await botApi.get(`/api/guilds/${guildId}/voice-xp/stats`);
    return response.data;
  },

  /**
   * Reset voice XP for entire guild
   */
  async resetGuild(guildId: string, reason?: string) {
    const response = await botApi.post(`/api/guilds/${guildId}/voice-xp/reset/guild`, {
      reason,
    });
    return response.data;
  },

  /**
   * Reset voice XP for a specific user
   */
  async resetUser(guildId: string, userId: string, reason?: string) {
    const response = await botApi.post(`/api/guilds/${guildId}/voice-xp/reset/user`, {
      userId,
      reason,
    });
    return response.data;
  },

  /**
   * Get active voice sessions for a guild
   */
  async getSessions(guildId: string) {
    const response = await botApi.get(`/api/guilds/${guildId}/voice-xp/sessions`);
    return response.data;
  },

  /**
   * Recalculate voice XP levels for a guild
   */
  async recalculate(guildId: string) {
    const response = await botApi.post(`/api/guilds/${guildId}/voice-xp/recalc`);
    return response.data;
  },
};
