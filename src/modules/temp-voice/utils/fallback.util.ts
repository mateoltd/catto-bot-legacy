/**
 * Fallback strategies for handling errors and edge cases
 */

import type { Guild, CategoryChannel } from 'discord.js';
import { ChannelType } from 'discord.js';
import { TEMP_VOICE_LIMITS } from '../constants.js';

/**
 * Result of finding a suitable category
 */
export interface CategoryFallbackResult {
  category: CategoryChannel | null;
  strategy: 'primary' | 'fallback' | 'auto' | 'none';
  reason?: string;
}

/**
 * Find a suitable category for creating temp channels with fallback logic
 */
export async function findSuitableCategory(
  guild: Guild,
  primaryCategoryId: string | null,
  fallbackCategoryId: string | null
): Promise<CategoryFallbackResult> {
  // Try primary category
  if (primaryCategoryId) {
    const primary = guild.channels.cache.get(primaryCategoryId);

    if (primary?.type === ChannelType.GuildCategory) {
      const category = primary as CategoryChannel;

      // Check if category is not full
      if (category.children.cache.size < TEMP_VOICE_LIMITS.MAX_CHANNELS_PER_CATEGORY) {
        return {
          category,
          strategy: 'primary',
        };
      }

      // Category is full, try fallback
      if (fallbackCategoryId) {
        const fallback = guild.channels.cache.get(fallbackCategoryId);

        if (fallback?.type === ChannelType.GuildCategory) {
          const fallbackCategory = fallback as CategoryChannel;

          if (fallbackCategory.children.cache.size < TEMP_VOICE_LIMITS.MAX_CHANNELS_PER_CATEGORY) {
            return {
              category: fallbackCategory,
              strategy: 'fallback',
              reason: 'Primary category is full',
            };
          }
        }
      }

      return {
        category: null,
        strategy: 'none',
        reason: 'Primary category is full and no suitable fallback',
      };
    }
  }

  // Try fallback category if primary doesn't exist
  if (fallbackCategoryId) {
    const fallback = guild.channels.cache.get(fallbackCategoryId);

    if (fallback?.type === ChannelType.GuildCategory) {
      const category = fallback as CategoryChannel;

      if (category.children.cache.size < TEMP_VOICE_LIMITS.MAX_CHANNELS_PER_CATEGORY) {
        return {
          category,
          strategy: 'fallback',
          reason: 'Primary category not found',
        };
      }
    }
  }

  // No category configured or available - create in guild root
  return {
    category: null,
    strategy: 'auto',
    reason: 'No suitable category configured',
  };
}

/**
 * Check if a guild has reached recommended channel limits
 */
export function checkGuildChannelLimits(guild: Guild): {
  withinLimits: boolean;
  currentCount: number;
  maxRecommended: number;
  warning?: string;
} {
  const currentCount = guild.channels.cache.size;
  const maxRecommended = TEMP_VOICE_LIMITS.MAX_RECOMMENDED_CHANNELS;

  return {
    withinLimits: currentCount < maxRecommended,
    currentCount,
    maxRecommended,
    warning:
      currentCount >= maxRecommended
        ? `Guild has ${currentCount} channels (recommended max: ${maxRecommended})`
        : undefined,
  };
}
