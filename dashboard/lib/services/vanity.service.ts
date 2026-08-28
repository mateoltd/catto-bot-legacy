import { botApi } from '@/lib/api';

export interface VanityConfig {
  enabled: boolean;
  keyword: string;
  roleId: string | null;
  thankYouEnabled: boolean;
  thankYouChannelId: string | null;
  thankYouMessage: string;
}

export interface VanityCleanupStatus {
  id: string;
  guildId: string;
  roleId: string;
  state: string;
  processed: number;
  removed: number;
  failed: number;
  total: number;
  failureReason: string | null;
}

export const vanityService = {
  async getConfig(guildId: string): Promise<{ config: VanityConfig }> {
    const response = await botApi.get(`/api/guilds/${guildId}/vanity/config`);
    return response.data;
  },

  async updateConfig(guildId: string, config: VanityConfig): Promise<{ config: VanityConfig }> {
    const response = await botApi.put(`/api/guilds/${guildId}/vanity/config`, config);
    return response.data;
  },

  async startCleanup(guildId: string): Promise<{ jobId: string }> {
    const response = await botApi.post(`/api/guilds/${guildId}/vanity/cleanup`);
    return response.data;
  },

  async getLatestCleanup(guildId: string): Promise<{ cleanup: VanityCleanupStatus | null }> {
    const response = await botApi.get(`/api/guilds/${guildId}/vanity/cleanup`);
    return response.data;
  },

  async getCleanup(guildId: string, jobId: string): Promise<{ cleanup: VanityCleanupStatus }> {
    const response = await botApi.get(`/api/guilds/${guildId}/vanity/cleanup/${jobId}`);
    return response.data;
  },
};
