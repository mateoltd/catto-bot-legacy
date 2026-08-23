/**
 * Service for managing temp voice configuration
 */

import { PrismaClient } from '@prisma/client';
import type { TempVoiceConfig as PrismaTempVoiceConfig } from '@prisma/client';
import type {
  TempVoiceConfig,
  TempVoiceConfigInput,
  TempVoiceConfigUpdate,
} from '../models/config.model.js';
import {
  DEFAULT_TEMP_VOICE_CONFIG,
  REDIS_KEYS,
  CACHE_TTL,
  type OwnerLeaveStrategy,
} from '../constants.js';
import { getJson, setJson, deleteJson } from '#lib/cache/typedCache.js';
import { z } from 'zod';
import type { Client } from 'discord.js';
import { ChannelType } from 'discord.js';

/**
 * Zod schema for cached config — passthrough to accept the full Prisma shape
 */
const tempVoiceConfigCacheSchema = z.object({}).passthrough();

export class TempVoiceConfigService {
  constructor(
    private prisma: PrismaClient,
    private client?: Client
  ) {}

  /**
   * Get configuration for a guild
   * Creates default config if it doesn't exist
   */
  async get(guildId: string): Promise<TempVoiceConfig> {
    // Try Redis cache first
    try {
      const cached = await getJson(this.cacheKey(guildId), tempVoiceConfigCacheSchema);
      if (cached) {
        return this.mapToModel(cached as PrismaTempVoiceConfig);
      }
    } catch {
      // Redis unavailable — fall through to Prisma
    }

    const config = await this.prisma.tempVoiceConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return this.create(guildId, DEFAULT_TEMP_VOICE_CONFIG);
    }

    // Store in Redis cache
    try {
      await setJson(this.cacheKey(guildId), tempVoiceConfigCacheSchema, config, CACHE_TTL.CONFIG);
    } catch {
      // Redis unavailable — continue without caching
    }

    return this.mapToModel(config);
  }

  /**
   * Get configuration without creating if it doesn't exist
   */
  async getOrNull(guildId: string): Promise<TempVoiceConfig | null> {
    // Try Redis cache first
    try {
      const cached = await getJson(this.cacheKey(guildId), tempVoiceConfigCacheSchema);
      if (cached) {
        return this.mapToModel(cached as PrismaTempVoiceConfig);
      }
    } catch {
      // Redis unavailable — fall through to Prisma
    }

    const config = await this.prisma.tempVoiceConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return null;
    }

    // Store in Redis cache
    try {
      await setJson(this.cacheKey(guildId), tempVoiceConfigCacheSchema, config, CACHE_TTL.CONFIG);
    } catch {
      // Redis unavailable — continue without caching
    }

    return this.mapToModel(config);
  }

  /**
   * Create configuration for a guild
   */
  async create(guildId: string, data: Partial<TempVoiceConfigInput>): Promise<TempVoiceConfig> {
    const config = await this.prisma.tempVoiceConfig.create({
      data: {
        guildId,
        ...data,
        joinToCreateChannels: data.joinToCreateChannels || [],
        adminRoleIds: data.adminRoleIds || [],
      },
    });

    await this.invalidateCache(guildId);

    return this.mapToModel(config);
  }

  /**
   * Update configuration for a guild
   */
  async update(guildId: string, data: TempVoiceConfigUpdate): Promise<TempVoiceConfig> {
    const config = await this.prisma.tempVoiceConfig.update({
      where: { guildId },
      data,
    });

    await this.invalidateCache(guildId);

    return this.mapToModel(config);
  }

  /**
   * Add a Join to Create channel
   */
  async addJoinChannel(guildId: string, channelId: string): Promise<string[]> {
    const config = await this.get(guildId);

    if (config.joinToCreateChannels.includes(channelId)) {
      throw new Error('Channel is already a Join to Create channel');
    }

    const updated = await this.update(guildId, {
      joinToCreateChannels: [...config.joinToCreateChannels, channelId],
    });

    return updated.joinToCreateChannels;
  }

  /**
   * Remove a Join to Create channel
   */
  async removeJoinChannel(guildId: string, channelId: string): Promise<string[]> {
    const config = await this.get(guildId);

    if (!config.joinToCreateChannels.includes(channelId)) {
      throw new Error('Channel is not a Join to Create channel');
    }

    const updated = await this.update(guildId, {
      joinToCreateChannels: config.joinToCreateChannels.filter((id) => id !== channelId),
    });

    return updated.joinToCreateChannels;
  }

  /**
   * Delete configuration for a guild
   * Also cleans up Discord channels and categories
   */
  async delete(guildId: string): Promise<void> {
    // Fetch the config first
    const config = await this.prisma.tempVoiceConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return; // Already deleted or doesn't exist
    }

    // If client is available, clean up Discord resources
    if (this.client) {
      try {
        const guild = await this.client.guilds.fetch(guildId).catch(() => null);

        if (guild) {
          // 1. Delete all active temp voice channels
          const tempChannels = await this.prisma.tempVoiceChannel.findMany({
            where: { guildId },
          });

          await Promise.all(
            tempChannels.map(async (tempChannel) => {
              try {
                const channel = await guild.channels.fetch(tempChannel.channelId).catch(() => null);
                if (channel) {
                  await channel.delete('Temp voice configuration deleted');
                }
              } catch (error) {
                // Continue even if individual channel deletion fails
                console.error(`Failed to delete temp channel ${tempChannel.channelId}:`, error);
              }
            })
          );

          // 2. Delete join-to-create channels
          const joinChannels = Array.isArray(config.joinToCreateChannels)
            ? (config.joinToCreateChannels as string[])
            : [];

          await Promise.all(
            joinChannels.map(async (channelId) => {
              try {
                const channel = await guild.channels.fetch(channelId).catch(() => null);
                if (channel) {
                  await channel.delete('Temp voice configuration deleted');
                }
              } catch (error) {
                // Continue even if join channel deletion fails
                console.error(`Failed to delete join channel ${channelId}:`, error);
              }
            })
          );

          // 3. Delete the category if it exists and is empty (or delete it anyway)
          if (config.categoryId) {
            try {
              const category = await guild.channels.fetch(config.categoryId).catch(() => null);
              if (category && category.type === ChannelType.GuildCategory) {
                if (category.children.cache.size === 0) {
                  await category.delete('Temp voice configuration deleted');
                } else {
                  console.log(
                    `Skipping deletion of category ${config.categoryId} - contains ${category.children.cache.size} channel(s)`
                  );
                }
              }
            } catch (error) {
              console.error(`Failed to delete category ${config.categoryId}:`, error);
            }
          }

          // 4. Delete fallback category if it exists
          if (config.fallbackCategoryId && config.fallbackCategoryId !== config.categoryId) {
            try {
              const category = await guild.channels
                .fetch(config.fallbackCategoryId)
                .catch(() => null);
              if (category && category.type === ChannelType.GuildCategory) {
                if (category.children.cache.size === 0) {
                  await category.delete('Temp voice configuration deleted');
                } else {
                  console.log(
                    `Skipping deletion of fallback category ${config.fallbackCategoryId} - contains ${category.children.cache.size} channel(s)`
                  );
                }
              }
            } catch (error) {
              console.error(
                `Failed to delete fallback category ${config.fallbackCategoryId}:`,
                error
              );
            }
          }
        }
      } catch (error) {
        // Log error but continue with database deletion
        console.error(`Failed to clean up Discord resources for guild ${guildId}:`, error);
      }
    }

    // Delete temp channel records first
    await this.prisma.tempVoiceChannel.deleteMany({
      where: { guildId },
    });

    // Finally, delete the config record
    await this.prisma.tempVoiceConfig.delete({
      where: { guildId },
    });

    await this.invalidateCache(guildId);
  }

  /**
   * Map Prisma model to TypeScript interface
   */
  private mapToModel(data: PrismaTempVoiceConfig): TempVoiceConfig {
    return {
      ...data,
      joinToCreateChannels: Array.isArray(data.joinToCreateChannels)
        ? (data.joinToCreateChannels as string[])
        : [],
      adminRoleIds: Array.isArray(data.adminRoleIds) ? (data.adminRoleIds as string[]) : [],
      customPatterns: Array.isArray(data.customPatterns) ? (data.customPatterns as string[]) : [],
      allowedKeywords: Array.isArray(data.allowedKeywords)
        ? (data.allowedKeywords as string[])
        : [],
      additionalLanguages: Array.isArray(data.additionalLanguages)
        ? (data.additionalLanguages as string[])
        : [],
      languageSettings:
        typeof data.languageSettings === 'object' && data.languageSettings !== null
          ? (data.languageSettings as Record<string, unknown>)
          : {},
      ownerLeaveStrategy: data.ownerLeaveStrategy as OwnerLeaveStrategy,
    };
  }

  /**
   * Build the Redis cache key for a guild's temp voice config
   */
  private cacheKey(guildId: string): string {
    return `${REDIS_KEYS.CONFIG_CACHE}:${guildId}`;
  }

  /**
   * Invalidate the Redis cache for a guild's temp voice config
   */
  private async invalidateCache(guildId: string): Promise<void> {
    try {
      await deleteJson(this.cacheKey(guildId));
    } catch {
      // Redis may be unavailable — ignore and continue
    }
  }
}
