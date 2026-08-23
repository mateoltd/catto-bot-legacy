import { botApi } from '@/lib/api';

export interface LogChannels {
  messages: boolean;
  voice: boolean;
  voiceState: boolean;
  tickets: boolean;
  transcripts: boolean;
  roles: boolean;
  channels: boolean;
  members: boolean;
  stage: boolean;
  events: boolean;
  polls: boolean;
  emojis: boolean;
  stickers: boolean;
  webhooks: boolean;
  joins: boolean;
  leaves: boolean;
  server: boolean;
}

export interface LogConfig {
  guildId: string;
  enabled: boolean;
  setup: boolean;
  categoryId: string | null;
  ignoredChannels: string[];
  channels: LogChannels;
}

export interface IgnoredChannelsResponse {
  ignoredChannels: string[];
  count: number;
}

export interface UpdateIgnoredChannelsResponse {
  success: boolean;
  message?: string;
  ignoredChannels: string[];
  count: number;
}

export type LogType =
  | 'messages'
  | 'voice'
  | 'voiceState'
  | 'joins'
  | 'leaves'
  | 'members'
  | 'roles'
  | 'channels'
  | 'server'
  | 'emojis'
  | 'stickers'
  | 'webhooks'
  | 'events'
  | 'stage'
  | 'polls'
  | 'tickets'
  | 'transcripts';

export interface LogSetupRequest {
  enabledTypes: LogType[];
  categoryName?: string;
}

export interface LogSetupResponse {
  success: boolean;
  message: string;
  categoryId: string;
  channelsCreated: number;
  enabledTypes: LogType[];
  errors?: string[];
}

export interface LogTypeInfo {
  key: string;
  name: string;
  description: string;
  category: 'core' | 'advanced';
  enabled: boolean;
  configured: boolean;
}

export interface LogTypesResponse {
  types: LogTypeInfo[];
  categorized: {
    core: LogTypeInfo[];
    advanced: LogTypeInfo[];
  };
  currentlyEnabled: string[];
  isConfigured: boolean;
  categoryId: string | null;
  ignoredChannels: string[];
}

export const loggingService = {
  /**
   * Get logging configuration for a guild
   */
  async getConfig(guildId: string): Promise<LogConfig> {
    const response = await botApi.get(`/api/guilds/${guildId}/logging/config`);
    return response.data;
  },

  /**
   * Get all available log types with their current status
   */
  async getTypes(guildId: string): Promise<LogTypesResponse> {
    const response = await botApi.get(`/api/guilds/${guildId}/logging/types`);
    return response.data;
  },

  /**
   * Update logging configuration for a guild
   */
  async updateConfig(
    guildId: string,
    config: { enabled?: boolean; ignoredChannels?: string[] }
  ): Promise<{ success: boolean; enabled: boolean; ignoredChannels: string[] }> {
    const response = await botApi.patch(`/api/guilds/${guildId}/logging/config`, config);
    return response.data;
  },

  /**
   * Get list of ignored channels
   */
  async getIgnoredChannels(guildId: string): Promise<IgnoredChannelsResponse> {
    const response = await botApi.get(`/api/guilds/${guildId}/logging/ignored-channels`);
    return response.data;
  },

  /**
   * Replace entire ignored channels list
   */
  async setIgnoredChannels(
    guildId: string,
    channelIds: string[]
  ): Promise<UpdateIgnoredChannelsResponse> {
    const response = await botApi.put(`/api/guilds/${guildId}/logging/ignored-channels`, {
      channelIds,
    });
    return response.data;
  },

  /**
   * Add a single channel to ignored list
   */
  async addIgnoredChannel(
    guildId: string,
    channelId: string
  ): Promise<UpdateIgnoredChannelsResponse> {
    const response = await botApi.post(`/api/guilds/${guildId}/logging/ignored-channels`, {
      channelId,
    });
    return response.data;
  },

  /**
   * Remove a single channel from ignored list
   */
  async removeIgnoredChannel(
    guildId: string,
    channelId: string
  ): Promise<UpdateIgnoredChannelsResponse> {
    const response = await botApi.delete(`/api/guilds/${guildId}/logging/ignored-channels`, {
      data: { channelId },
    });
    return response.data;
  },

  /**
   * Setup logging system for a guild
   * Creates category, channels, and webhooks for selected log types
   */
  async setup(guildId: string, request: LogSetupRequest): Promise<LogSetupResponse> {
    const response = await botApi.post(`/api/guilds/${guildId}/logging/setup`, request);
    return response.data;
  },

  /**
   * Toggle a specific log type on/off
   * If enabling a log type that wasn't set up, it creates the channel and webhook
   */
  async toggleLogType(
    guildId: string,
    logType: LogType,
    enabled: boolean
  ): Promise<{ success: boolean; logType: string; enabled: boolean; message: string }> {
    const response = await botApi.patch(`/api/guilds/${guildId}/logging/toggle`, {
      logType,
      enabled,
    });
    return response.data;
  },

  /**
   * Delete the logging system for a guild
   * Removes all log channels and the category
   */
  async delete(
    guildId: string
  ): Promise<{ success: boolean; deletedChannels: number; message: string }> {
    const response = await botApi.delete(`/api/guilds/${guildId}/logging/delete`);
    return response.data;
  },
};
