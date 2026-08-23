/**
 * Service for managing temporary voice channels
 */

import { PrismaClient, TempVoiceChannel } from '@prisma/client';
import { container } from '@sapphire/framework';
import type { Guild, GuildMember, VoiceChannel, CategoryChannel } from 'discord.js';
import { ChannelType } from 'discord.js';
import type { UpdateTempChannelData } from '../models/temp-channel.model.js';
import type { TempVoiceConfig } from '../models/config.model.js';
import { PermissionsService } from './permissions.service.js';
import { UserPreferencesService } from './user-preferences.service.js';
import { generateChannelName } from '../utils/naming.util.js';
import { findSuitableCategory } from '../utils/fallback.util.js';

export class TempChannelService {
  private userPrefsService: UserPreferencesService;

  constructor(
    private prisma: PrismaClient,
    private permissionsService: PermissionsService
  ) {
    this.userPrefsService = new UserPreferencesService(prisma);
  }

  /**
   * Create a new temporary voice channel
   */
  async createChannel(
    guild: Guild,
    owner: GuildMember,
    config: TempVoiceConfig,
    sourceChannelId: string
  ): Promise<VoiceChannel> {
    // Find suitable category
    const categoryResult = await findSuitableCategory(
      guild,
      config.categoryId,
      config.fallbackCategoryId
    );

    if (!categoryResult.category && categoryResult.strategy === 'none') {
      throw new Error('No suitable category available for temp channel creation');
    }

    // Get user preferences if customization is allowed
    const userPrefs = config.allowCustomization
      ? await this.userPrefsService.get(guild.id, owner.id)
      : null;

    // Get current channel count for naming
    const existingCount = await this.prisma.tempVoiceChannel.count({
      where: { guildId: guild.id },
    });

    // Generate channel name (use saved preference or default)
    const channelName =
      userPrefs?.customName ||
      generateChannelName(
        config.defaultNameTemplate,
        owner,
        existingCount + 1,
        config.namingScheme
      );

    // Determine settings (use preferences if customization allowed, otherwise use defaults)
    const isLocked = userPrefs?.preferLocked ?? config.defaultLocked;
    const isHidden = userPrefs?.preferHidden ?? config.defaultHidden;
    const userLimit = (userPrefs?.customUserLimit ?? config.defaultUserLimit) || 0;
    const bitrate = userPrefs?.customBitrate ?? config.defaultBitrate;
    const region = userPrefs?.customRegion ?? config.defaultRegion;

    // Get category permissions if it exists
    let permissionOverwrites;
    if (categoryResult.category && !config.allowCustomization) {
      // Inherit category permissions when customization is disabled
      const category = categoryResult.category as CategoryChannel;
      permissionOverwrites = category.permissionOverwrites.cache.map((overwrite) => ({
        id: overwrite.id,
        allow: overwrite.allow.toArray(),
        deny: overwrite.deny.toArray(),
        type: overwrite.type,
      }));

      // Add owner permissions on top
      permissionOverwrites.push({
        id: owner.id,
        allow: ['ViewChannel', 'Connect', 'Speak', 'Stream', 'UseVAD'],
        deny: [],
        type: 1, // Member
      });
    } else {
      // Build custom permission overwrites when customization is allowed
      permissionOverwrites = this.permissionsService.buildOverwrites({
        ownerId: owner.id,
        guildId: guild.id,
        isLocked,
        isHidden,
        allowedUserIds: userPrefs?.allowedUserIds || [],
        deniedUserIds: userPrefs?.deniedUserIds || [],
        trustedUserIds: userPrefs?.trustedUserIds || [],
      });
    }

    // Create the voice channel
    let channel: VoiceChannel;
    try {
      // Calculate max bitrate based on guild boost level
      const maxBitrate = guild.maximumBitrate || 64000; // Default to 64kbps if unavailable
      const requestedBitrate = bitrate ? bitrate * 1000 : undefined;
      const finalBitrate = requestedBitrate ? Math.min(requestedBitrate, maxBitrate) : undefined;

      channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: categoryResult.category?.id || null,
        userLimit,
        bitrate: finalBitrate,
        rtcRegion: region && region !== 'auto' ? region : undefined,
        permissionOverwrites,
        reason: `Temp voice channel for ${owner.user.tag}`,
      });
    } catch (error: unknown) {
      // Handle Discord API errors
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 50013) {
          throw new Error('Bot missing permissions to create channels');
        }
        if (error.code === 30013) {
          throw new Error('Maximum number of channels reached');
        }
      }
      throw error;
    }
    try {
      await this.prisma.tempVoiceChannel.create({
        data: {
          guildId: guild.id,
          channelId: channel.id,
          ownerId: owner.id,
          createdByJoinChannelId: sourceChannelId,
          isLocked,
          isHidden,
          allowedUserIds: userPrefs?.allowedUserIds || [],
          deniedUserIds: userPrefs?.deniedUserIds || [],
          trustedUserIds: userPrefs?.trustedUserIds || [],
          metadata: {
            creationAttempts: 1,
            categoryStrategy: categoryResult.strategy,
          },
        },
      });
    } catch (error) {
      // Delete the Discord channel to prevent orphans if the DB record fails
      try {
        await channel.delete('Cleaning up orphaned channel after database error');
      } catch {
        // Best-effort cleanup — channel may already be gone
      }
      throw error;
    }

    return channel;
  }

  /**
   * Get a temp voice channel by channel ID
   */
  async getByChannelId(channelId: string): Promise<TempVoiceChannel | null> {
    const channel = await this.prisma.tempVoiceChannel.findUnique({
      where: { channelId },
    });

    return channel ? this.mapToModel(channel) : null;
  }

  /**
   * Get all temp channels for a guild
   */
  async getByGuildId(guildId: string): Promise<TempVoiceChannel[]> {
    const channels = await this.prisma.tempVoiceChannel.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });

    return channels.map((c) => this.mapToModel(c));
  }

  /**
   * Get temp channels owned by a user
   */
  async getByOwnerId(guildId: string, ownerId: string): Promise<TempVoiceChannel[]> {
    const channels = await this.prisma.tempVoiceChannel.findMany({
      where: { guildId, ownerId },
      orderBy: { createdAt: 'desc' },
    });

    return channels.map((c) => this.mapToModel(c));
  }

  /**
   * Count active channels for a user in a guild
   */
  async countUserChannels(guildId: string, ownerId: string): Promise<number> {
    return this.prisma.tempVoiceChannel.count({
      where: { guildId, ownerId },
    });
  }

  /**
   * Update a temp voice channel
   */
  async update(channelId: string, data: UpdateTempChannelData): Promise<TempVoiceChannel> {
    const updated = await this.prisma.tempVoiceChannel.update({
      where: { channelId },
      data,
    });

    return this.mapToModel(updated);
  }

  /**
   * Delete a temp voice channel record
   */
  async delete(channelId: string): Promise<void> {
    // Use deleteMany to avoid errors if record doesn't exist
    await this.prisma.tempVoiceChannel.deleteMany({
      where: { channelId },
    });
  }

  /**
   * Update last active timestamp
   */
  async updateLastActive(channelId: string): Promise<void> {
    await this.prisma.tempVoiceChannel.update({
      where: { channelId },
      data: { lastActiveAt: new Date() },
    });
  }

  /**
   * Get all temp channels for a guild
   */
  static async getGuildTempChannels(guildId: string) {
    const channels = await container.prisma.tempVoiceChannel.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });

    return channels.map((channel: TempVoiceChannel) => ({
      channelId: channel.channelId,
      guildId: channel.guildId,
      ownerId: channel.ownerId,
      createdAt: channel.createdAt,
      lastActiveAt: channel.lastActiveAt,
      isLocked: channel.isLocked,
      isHidden: channel.isHidden,
      allowedUserIds: Array.isArray(channel.allowedUserIds) ? channel.allowedUserIds : [],
      deniedUserIds: Array.isArray(channel.deniedUserIds) ? channel.deniedUserIds : [],
      trustedUserIds: Array.isArray(channel.trustedUserIds) ? channel.trustedUserIds : [],
    }));
  }

  /**
   * Map Prisma model to TypeScript interface
   */
  private mapToModel(data: TempVoiceChannel): TempVoiceChannel {
    return {
      ...data,
      allowedUserIds: Array.isArray(data.allowedUserIds) ? data.allowedUserIds : [],
      deniedUserIds: Array.isArray(data.deniedUserIds) ? data.deniedUserIds : [],
      metadata: typeof data.metadata === 'object' ? data.metadata : {},
    };
  }
}
