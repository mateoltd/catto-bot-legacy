import { botApi } from '@/lib/api';

export type OwnerLeaveStrategy = 'TRANSFER' | 'KEEP' | 'DELETE';

export interface TempVoiceConfig {
  guildId: string;
  enabled: boolean;
  joinChannelIds: string[];
  namingScheme: 'username' | 'displayname' | 'sequential' | 'custom';
  customNamingPattern: string | null;
  userLimit: number | null;
  bitrate: number | null;
  defaultCategoryId: string | null;
  defaultLocked: boolean;
  defaultHidden: boolean;
  ownerLeaveStrategy: OwnerLeaveStrategy;
  autoDeleteEmpty: boolean;
  deleteEmptyAfterMs: number;
  autoDeleteOwnerLeave: boolean;
  deleteOwnerLeaveAfterMs: number;
  allowOwnerTransfer: boolean;
  allowOwnerManagement: boolean;
  maxChannelsPerUser: number;
  enableNameModeration: boolean;
  blockedKeywords: string[];
  logChannelId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TempVoiceConfigCreate {
  enabled?: boolean;
  joinChannelIds?: string[];
  namingScheme?: 'username' | 'displayname' | 'sequential' | 'custom';
  customNamingPattern?: string | null;
  userLimit?: number | null;
  bitrate?: number | null;
  defaultCategoryId?: string | null;
  defaultLocked?: boolean;
  defaultHidden?: boolean;
  ownerLeaveStrategy?: OwnerLeaveStrategy;
  autoDeleteEmpty?: boolean;
  deleteEmptyAfterMs?: number;
  autoDeleteOwnerLeave?: boolean;
  deleteOwnerLeaveAfterMs?: number;
  allowOwnerTransfer?: boolean;
  allowOwnerManagement?: boolean;
  maxChannelsPerUser?: number;
  enableNameModeration?: boolean;
  blockedKeywords?: string[];
  logChannelId?: string | null;
}

export interface TempVoiceConfigUpdate extends Partial<TempVoiceConfigCreate> {}

export interface TempVoiceChannelMember {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

export interface TempVoiceChannelPermissions {
  isLocked: boolean;
  isHidden: boolean;
  allowedUserIds: string[];
  deniedUserIds: string[];
}

export interface TempVoiceChannel {
  channelId: string;
  channelName?: string;
  ownerId: string;
  ownerUsername?: string;
  categoryId?: string | null;
  categoryName?: string;
  userLimit?: number;
  bitrate?: number;
  memberCount?: number;
  members?: TempVoiceChannelMember[];
  permissions?: TempVoiceChannelPermissions;
  createdAt: string;
  status: 'active' | 'deleted';
}

export interface TempVoiceChannelsData {
  guildId: string;
  totalChannels: number;
  channels: TempVoiceChannel[];
}

export interface TempVoiceStats {
  guildId: string;
  config: {
    enabled: boolean;
    joinChannelCount: number;
    joinChannels: { id: string; name: string; exists: boolean }[];
    maxChannelsPerUser: number;
  };
  stats: {
    totalChannelsCreated: number;
    activeChannels: number;
    emptyChannels: number;
    totalMembers: number;
    averageMembersPerChannel: number;
    uniqueOwners: number;
    mostActiveOwner: {
      userId: string;
      username?: string;
      channelCount: number;
    } | null;
  };
  timestamp: string;
}

export interface TempVoiceSetupRequest {
  categoryName?: string;
  joinChannelName?: string;
  logsChannelName?: string;
}

// Backend wraps responses in { success, data } or { success, error }
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface TempVoiceSetupData {
  category: { id: string; name: string };
  joinChannel: { id: string; name: string };
  logsChannel: { id: string; name: string };
  config: TempVoiceConfig;
  instructions: string;
}

export interface TempVoiceChannelValidation {
  channelId: string;
  channelName?: string;
  valid: boolean;
  error?: string;
}

export interface TempVoiceCategoryValidation {
  categoryId: string;
  categoryName?: string;
  valid: boolean;
  error?: string;
}

export interface TempVoiceValidationResult {
  valid: boolean;
  schema: {
    valid: boolean;
    message: string;
  };
  joinChannels: {
    count: number;
    validations: TempVoiceChannelValidation[];
    allValid: boolean;
  };
  defaultCategory?: TempVoiceCategoryValidation;
  logChannel?: TempVoiceChannelValidation;
}

export const tempVoiceService = {
  /**
   * Get temp voice configuration for a guild
   * Backend returns: { success, data: TempVoiceConfig } or 404 if not found
   */
  async getConfig(guildId: string): Promise<TempVoiceConfig | null> {
    try {
      const response = await botApi.get<ApiResponse<TempVoiceConfig>>(
        `/api/guilds/${guildId}/temp-voice/config`
      );
      return response.data.data || null;
    } catch (error) {
      // 404 means config doesn't exist yet
      if ((error as { response?: { status?: number } })?.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Create temp voice configuration for a guild
   */
  async createConfig(guildId: string, config: TempVoiceConfigCreate): Promise<TempVoiceConfig> {
    const response = await botApi.post<ApiResponse<TempVoiceConfig>>(
      `/api/guilds/${guildId}/temp-voice/config`,
      config
    );
    if (!response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to create config');
    }
    return response.data.data;
  },

  /**
   * Update temp voice configuration for a guild
   */
  async updateConfig(guildId: string, config: TempVoiceConfigUpdate): Promise<TempVoiceConfig> {
    const response = await botApi.patch<ApiResponse<TempVoiceConfig>>(
      `/api/guilds/${guildId}/temp-voice/config`,
      config
    );
    if (!response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to update config');
    }
    return response.data.data;
  },

  /**
   * Delete temp voice configuration for a guild
   */
  async deleteConfig(guildId: string): Promise<void> {
    await botApi.delete(`/api/guilds/${guildId}/temp-voice/config`);
  },

  /**
   * Get all active temporary voice channels
   */
  async getChannels(guildId: string): Promise<TempVoiceChannelsData> {
    const response = await botApi.get<ApiResponse<TempVoiceChannelsData>>(
      `/api/guilds/${guildId}/temp-voice/channels`
    );
    return response.data.data || { guildId, totalChannels: 0, channels: [] };
  },

  /**
   * Get temp voice statistics for a guild
   */
  async getStats(guildId: string): Promise<TempVoiceStats | null> {
    try {
      const response = await botApi.get<ApiResponse<TempVoiceStats>>(
        `/api/guilds/${guildId}/temp-voice/stats`
      );
      return response.data.data || null;
    } catch {
      return null;
    }
  },

  /**
   * Auto-setup temp voice system
   * Creates category, join channel, log channel with webhook, and config
   */
  async setup(guildId: string, request: TempVoiceSetupRequest): Promise<TempVoiceSetupData> {
    const response = await botApi.post<ApiResponse<TempVoiceSetupData>>(
      `/api/guilds/${guildId}/temp-voice/setup`,
      request
    );
    if (!response.data.data) {
      throw new Error(response.data.error?.message || 'Setup failed');
    }
    return response.data.data;
  },

  /**
   * Add a join channel to the temp voice system
   */
  async addJoinChannel(guildId: string, channelId: string): Promise<{ joinChannelIds: string[] }> {
    const response = await botApi.post<
      ApiResponse<{
        guildId: string;
        channelId: string;
        channelName: string;
        joinChannelIds: string[];
      }>
    >(`/api/guilds/${guildId}/temp-voice/join-channels`, { channelId });
    if (!response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to add join channel');
    }
    return { joinChannelIds: response.data.data.joinChannelIds };
  },

  /**
   * Remove a join channel from the temp voice system
   */
  async removeJoinChannel(
    guildId: string,
    channelId: string
  ): Promise<{ joinChannelIds: string[] }> {
    const response = await botApi.delete<
      ApiResponse<{ guildId: string; channelId: string; joinChannelIds: string[] }>
    >(`/api/guilds/${guildId}/temp-voice/join-channels/${channelId}`);
    if (!response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to remove join channel');
    }
    return { joinChannelIds: response.data.data.joinChannelIds };
  },

  /**
   * Validate temp voice configuration without saving
   * Checks if channels exist and are the correct type
   */
  async validateConfig(
    guildId: string,
    config: TempVoiceConfigCreate
  ): Promise<TempVoiceValidationResult> {
    const response = await botApi.post<
      ApiResponse<TempVoiceValidationResult> & { valid?: boolean }
    >(`/api/guilds/${guildId}/temp-voice/validate`, config);

    if (!response.data.data && !response.data.valid) {
      throw new Error(response.data.error?.message || 'Validation failed');
    }

    // Handle both response formats (data wrapper or direct)
    return (
      response.data.data || {
        valid: response.data.valid || false,
        schema: { valid: true, message: 'Configuration schema is valid' },
        joinChannels: { count: 0, validations: [], allValid: true },
      }
    );
  },
};
