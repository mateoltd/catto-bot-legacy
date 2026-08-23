/**
 * Static service wrapper for TempVoiceConfigService
 * Provides static methods for API route usage
 */

import { container } from '@sapphire/framework';
import type { TempVoiceConfigInput, TempVoiceConfigUpdate } from '../models/config.model.js';
import { TempVoiceConfigService } from './config.service.js';
import { OwnerLeaveStrategy } from '../constants.js';
import { TempVoiceNamingScheme } from '@prisma/client';

const configService = new TempVoiceConfigService(container.prisma, container.client);

/**
 * Map API naming scheme strings to database enum
 */
function mapNamingSchemeToDb(
  scheme: 'username' | 'displayname' | 'sequential' | 'custom'
): TempVoiceNamingScheme {
  const mapping = {
    username: TempVoiceNamingScheme.USERNAME,
    displayname: TempVoiceNamingScheme.DISPLAYNAME,
    sequential: TempVoiceNamingScheme.SEQUENTIAL,
    custom: TempVoiceNamingScheme.CUSTOM,
  };
  return mapping[scheme];
}

/**
 * Map database enum to API naming scheme strings
 */
function mapNamingSchemeFromDb(
  scheme: TempVoiceNamingScheme
): 'username' | 'displayname' | 'sequential' | 'custom' {
  const mapping = {
    [TempVoiceNamingScheme.USERNAME]: 'username' as const,
    [TempVoiceNamingScheme.DISPLAYNAME]: 'displayname' as const,
    [TempVoiceNamingScheme.SEQUENTIAL]: 'sequential' as const,
    [TempVoiceNamingScheme.CUSTOM]: 'custom' as const,
  };
  return mapping[scheme];
}

/**
 * API request payload for creating/updating temp voice config
 */
export interface TempVoiceConfigApiInput {
  enabled?: boolean;
  joinChannelIds?: string[];
  namingScheme?: 'username' | 'custom' | 'displayname' | 'sequential';
  customNamingPattern?: string | null;
  userLimit?: number;
  bitrate?: number;
  defaultCategoryId?: string | null;
  deleteEmptyAfterMs?: number;
  ownerLeaveStrategy?: OwnerLeaveStrategy;
  allowOwnerTransfer?: boolean;
  allowOwnerManagement?: boolean;
  maxChannelsPerUser?: number;
  logChannelId?: string | null;
  logWebhook?: string | null;
}

/**
 * Map a TempVoiceConfig to the API response format
 */
function mapConfigToApiResponse(config: import('../models/config.model.js').TempVoiceConfig) {
  return {
    guildId: config.guildId,
    enabled: config.enabled,
    joinChannelIds: config.joinToCreateChannels,
    namingScheme: mapNamingSchemeFromDb(config.namingScheme),
    customNamingPattern: config.defaultNameTemplate,
    userLimit: config.defaultUserLimit,
    bitrate: config.defaultBitrate ?? 64000,
    defaultCategoryId: config.categoryId,
    autoDeleteEmpty: true,
    deleteEmptyAfterMs: config.deleteDelaySeconds * 1000,
    ownerLeaveStrategy: config.ownerLeaveStrategy,
    allowOwnerTransfer: config.ownerLeaveStrategy === OwnerLeaveStrategy.TRANSFER,
    allowOwnerManagement: config.controlPanelEnabled,
    maxChannelsPerUser: config.maxChannelsPerUser,
    logChannelId: config.logChannelId,
    logWebhook: config.logWebhook,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

/**
 * Static wrapper for temp voice configuration operations
 */
export class TempVoiceConfigServiceStatic {
  /**
   * Get configuration for a guild (returns null if not found)
   */
  static async getConfig(guildId: string) {
    const config = await configService.getOrNull(guildId);

    if (!config) {
      return null;
    }

    return mapConfigToApiResponse(config);
  }

  /**
   * Create configuration for a guild
   */
  static async createConfig(guildId: string, data: TempVoiceConfigApiInput) {
    // Map API input to service input
    const serviceData: Partial<TempVoiceConfigInput> = {
      enabled: data.enabled,
      joinToCreateChannels: data.joinChannelIds || [],
      namingScheme: data.namingScheme
        ? mapNamingSchemeToDb(data.namingScheme)
        : TempVoiceNamingScheme.USERNAME,
      defaultNameTemplate: data.customNamingPattern || "{username}'s Channel",
      defaultUserLimit: data.userLimit ?? 0,
      defaultBitrate: data.bitrate ?? 64000,
      categoryId: data.defaultCategoryId,
      deleteDelaySeconds: Math.floor((data.deleteEmptyAfterMs ?? 60000) / 1000),
      ownerLeaveStrategy: data.ownerLeaveStrategy ?? OwnerLeaveStrategy.TRANSFER,
      maxChannelsPerUser: data.maxChannelsPerUser ?? 1,
      logChannelId: data.logChannelId,
      logWebhook: data.logWebhook,
      controlPanelEnabled: data.allowOwnerManagement ?? true,
    };

    const config = await configService.create(guildId, serviceData);

    return mapConfigToApiResponse(config);
  }

  /**
   * Update configuration for a guild
   */
  static async updateConfig(guildId: string, data: Partial<TempVoiceConfigApiInput>) {
    // Map API input to service input
    const serviceData: TempVoiceConfigUpdate = {
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.joinChannelIds && { joinToCreateChannels: data.joinChannelIds }),
      ...(data.namingScheme !== undefined && {
        namingScheme: mapNamingSchemeToDb(data.namingScheme),
      }),
      ...(data.customNamingPattern !== undefined && {
        defaultNameTemplate: data.customNamingPattern ?? undefined,
      }),
      ...(data.userLimit !== undefined && { defaultUserLimit: data.userLimit }),
      ...(data.bitrate !== undefined && { defaultBitrate: data.bitrate }),
      ...(data.defaultCategoryId !== undefined && {
        categoryId: data.defaultCategoryId ?? undefined,
      }),
      ...(data.deleteEmptyAfterMs !== undefined && {
        deleteDelaySeconds: Math.floor(data.deleteEmptyAfterMs / 1000),
      }),
      ...(data.ownerLeaveStrategy !== undefined && {
        ownerLeaveStrategy: data.ownerLeaveStrategy,
      }),
      ...(data.allowOwnerManagement !== undefined && {
        controlPanelEnabled: data.allowOwnerManagement,
      }),
      ...(data.maxChannelsPerUser !== undefined && {
        maxChannelsPerUser: data.maxChannelsPerUser,
      }),
      ...(data.logChannelId !== undefined && { logChannelId: data.logChannelId ?? undefined }),
      ...(data.logWebhook !== undefined && { logWebhook: data.logWebhook ?? undefined }),
    };

    const config = await configService.update(guildId, serviceData);

    return mapConfigToApiResponse(config);
  }

  /**
   * Delete configuration for a guild
   */
  static async deleteConfig(guildId: string): Promise<void> {
    await configService.delete(guildId);
  }

  /**
   * Add a join-to-create channel
   */
  static async addJoinChannel(guildId: string, channelId: string) {
    const joinChannels = await configService.addJoinChannel(guildId, channelId);
    const config = await configService.getOrNull(guildId);

    return {
      joinChannelIds: joinChannels,
      ...config,
    };
  }

  /**
   * Remove a join-to-create channel
   */
  static async removeJoinChannel(guildId: string, channelId: string) {
    const joinChannels = await configService.removeJoinChannel(guildId, channelId);
    const config = await configService.getOrNull(guildId);

    return {
      joinChannelIds: joinChannels,
      ...config,
    };
  }
}
