/**
 * Service for managing temp voice configuration
 */

import { PrismaClient } from "@prisma/client";
import type { TempVoiceConfig as PrismaTempVoiceConfig } from "@prisma/client";
import type {
  TempVoiceConfig,
  TempVoiceConfigInput,
  TempVoiceConfigUpdate,
} from "../models/config.model.js";
import {
  DEFAULT_TEMP_VOICE_CONFIG,
  REDIS_KEYS,
  CACHE_TTL,
} from "../constants.js";
import { getJson, setJson, deleteJson } from "#lib/cache/typedCache.js";
import { z } from "zod";
import type { Client } from "discord.js";
import { normalizeConfigBitrateKbps } from "../domain/temp-voice-bitrate.js";

/**
 * Zod schema for cached config — passthrough to accept the full Prisma shape
 */
const tempVoiceConfigCacheSchema = z.object({}).passthrough();

export class TempVoiceConfigService {
  constructor(
    private prisma: PrismaClient,
    _client?: Client,
  ) {}

  /**
   * Get configuration for a guild
   * Creates default config if it doesn't exist
   */
  async get(guildId: string): Promise<TempVoiceConfig> {
    // Try Redis cache first
    try {
      const cached = await getJson(
        this.cacheKey(guildId),
        tempVoiceConfigCacheSchema,
      );
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
      await setJson(
        this.cacheKey(guildId),
        tempVoiceConfigCacheSchema,
        config,
        CACHE_TTL.CONFIG,
      );
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
      const cached = await getJson(
        this.cacheKey(guildId),
        tempVoiceConfigCacheSchema,
      );
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
      await setJson(
        this.cacheKey(guildId),
        tempVoiceConfigCacheSchema,
        config,
        CACHE_TTL.CONFIG,
      );
    } catch {
      // Redis unavailable — continue without caching
    }

    return this.mapToModel(config);
  }

  /**
   * Create configuration for a guild
   */
  async create(
    guildId: string,
    data: Partial<TempVoiceConfigInput>,
  ): Promise<TempVoiceConfig> {
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
  async update(
    guildId: string,
    data: TempVoiceConfigUpdate,
  ): Promise<TempVoiceConfig> {
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
      throw new Error("Channel is already a Join to Create channel");
    }

    const updated = await this.update(guildId, {
      joinToCreateChannels: [...config.joinToCreateChannels, channelId],
    });

    return updated.joinToCreateChannels;
  }

  /**
   * Remove a Join to Create channel
   */
  async removeJoinChannel(
    guildId: string,
    channelId: string,
  ): Promise<string[]> {
    const config = await this.get(guildId);

    if (!config.joinToCreateChannels.includes(channelId)) {
      throw new Error("Channel is not a Join to Create channel");
    }

    const updated = await this.update(guildId, {
      joinToCreateChannels: config.joinToCreateChannels.filter(
        (id) => id !== channelId,
      ),
    });

    return updated.joinToCreateChannels;
  }

  /**
   * Hide the configuration and durably drain every managed channel. The sweeper removes the
   * internal row after every aggregate reaches DELETED.
   * Setup resources are deliberately preserved; deleting categories or join channels is a
   * separate administrator decision and must not be coupled to eventual channel cleanup.
   */
  async delete(guildId: string): Promise<void> {
    const config = await this.prisma.tempVoiceConfig.findUnique({
      where: { guildId },
    });
    if (!config) return;

    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.tempVoiceConfig.update({
        where: { guildId },
        data: { enabled: false, drainingAt: now },
      });
      const channels = await transaction.tempVoiceChannel.findMany({
        where: { guildId, lifecycle: { not: "DELETED" } },
      });
      for (const channel of channels) {
        const revision = channel.revision + 1;
        await transaction.tempVoiceChannel.update({
          where: { id: channel.id },
          data: {
            lifecycle: "DELETING",
            emptySince: now,
            deleteAfter: now,
            nextReconcileAt: now,
            revision: { increment: 1 },
          },
        });
        await transaction.tempVoiceOutbox.create({
          data: {
            aggregateId: channel.id,
            revision,
            kind: "DELETE_CHANNEL",
            dedupeKey: `${channel.id}:${revision}:config-drain`,
            payload: { force: true },
            availableAt: now,
          },
        });
      }
    });
    await this.invalidateCache(guildId);
  }

  /**
   * Map Prisma model to TypeScript interface
   */
  private mapToModel(data: PrismaTempVoiceConfig): TempVoiceConfig {
    return {
      ...data,
      defaultBitrate: normalizeConfigBitrateKbps(data.defaultBitrate),
      joinToCreateChannels: Array.isArray(data.joinToCreateChannels)
        ? (data.joinToCreateChannels as string[])
        : [],
      adminRoleIds: Array.isArray(data.adminRoleIds)
        ? (data.adminRoleIds as string[])
        : [],
      customPatterns: Array.isArray(data.customPatterns)
        ? (data.customPatterns as string[])
        : [],
      allowedKeywords: Array.isArray(data.allowedKeywords)
        ? (data.allowedKeywords as string[])
        : [],
      additionalLanguages: Array.isArray(data.additionalLanguages)
        ? (data.additionalLanguages as string[])
        : [],
      languageSettings:
        typeof data.languageSettings === "object" &&
        data.languageSettings !== null
          ? (data.languageSettings as Record<string, unknown>)
          : {},
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
