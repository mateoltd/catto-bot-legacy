import { botApi } from '@/lib/api';
import type { GuildData } from '@/lib/types';

export interface GuildInfo {
  id: string;
  name: string;
  language: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  discord: {
    name: string;
    icon: string | null;
    banner: string | null;
    splash: string | null;
    description: string | null;
    memberCount: number;
    ownerId: string;
    verified: boolean;
    premiumTier: number;
    premiumSubscriptionCount: number | null;
    vanityURLCode: string | null;
  } | null;
}

export interface GuildUpdateData {
  language?: 'en-US' | 'es-ES' | 'fr-FR';
  settings?: Record<string, unknown>;
}

export interface GuildUpdateResponse {
  message: string;
  guild: {
    id: string;
    name: string;
    language: string;
    settings: Record<string, unknown>;
    updatedAt: string;
  };
}

export const guildService = {
  /**
   * Get channels and roles for a guild
   */
  async getChannelsAndRoles(guildId: string): Promise<GuildData> {
    const response = await botApi.get(`/api/guilds/${guildId}/channels-roles`);
    return response.data;
  },

  /**
   * Get guild information
   */
  async getGuild(guildId: string): Promise<GuildInfo> {
    const response = await botApi.get(`/api/guilds/${guildId}`);
    return response.data;
  },

  /**
   * Update guild settings (language, custom settings)
   */
  async updateGuild(guildId: string, data: GuildUpdateData): Promise<GuildUpdateResponse> {
    const response = await botApi.patch(`/api/guilds/${guildId}`, data);
    return response.data;
  },
};
