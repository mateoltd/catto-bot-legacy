/**
 * XP Configuration Service
 * Manages guild XP configuration with TTL-based caching
 */

import type { GuildXPConfig } from '@prisma/client';
import type { UpdateXPConfigDTO } from '../dtos/index.js';
import * as configRepo from '../repositories/xp-text-config.repository.js';

/**
 * Cache entry type
 */
interface ConfigCacheEntry {
  config: GuildXPConfig;
  cachedAt: number;
}

/**
 * Configuration cache with TTL
 * Key: guildId
 * Value: { config, cachedAt }
 */
const configCache = new Map<string, ConfigCacheEntry>();

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Get XP configuration for a guild
 * Uses cache if available and not expired
 *
 * @param guildId Guild ID
 * @param bypassCache Skip cache and fetch from DB
 * @returns Guild XP configuration
 */
export async function getConfig(
  guildId: string,
  bypassCache: boolean = false
): Promise<GuildXPConfig> {
  // Check cache first
  if (!bypassCache) {
    const cached = configCache.get(guildId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return cached.config;
    }
  }

  // Fetch from database
  const config = await configRepo.getXPConfig(guildId);

  // Update cache
  configCache.set(guildId, {
    config,
    cachedAt: Date.now(),
  });

  return config;
}

/**
 * Update XP configuration for a guild
 * Invalidates cache after update
 *
 * @param guildId Guild ID
 * @param data Update data
 * @returns Updated configuration
 */
export async function updateConfig(
  guildId: string,
  data: UpdateXPConfigDTO
): Promise<GuildXPConfig> {
  const config = await configRepo.updateXPConfig(guildId, data);

  // Invalidate cache
  invalidateCache(guildId);

  return config;
}

/**
 * Delete XP configuration for a guild
 * Invalidates cache after deletion
 *
 * @param guildId Guild ID
 */
export async function deleteConfig(guildId: string): Promise<void> {
  await configRepo.deleteXPConfig(guildId);

  // Invalidate cache
  invalidateCache(guildId);
}

/**
 * Check if XP system is enabled for a guild
 * Uses cached config if available
 *
 * @param guildId Guild ID
 * @returns True if enabled
 */
export async function isEnabled(guildId: string): Promise<boolean> {
  const config = await getConfig(guildId);
  return config.enabled;
}

/**
 * Invalidate cache for a specific guild
 * Call this when config is updated via API
 *
 * @param guildId Guild ID
 */
export function invalidateCache(guildId: string): void {
  configCache.delete(guildId);
}

/**
 * Invalidate all cached configs
 * Useful for maintenance or bulk operations
 */
export function invalidateAllCache(): void {
  configCache.clear();
}

/**
 * Get cache statistics
 * Useful for monitoring and debugging
 *
 * @returns Cache stats
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{ guildId: string; age: number; expired: boolean }>;
} {
  const now = Date.now();
  const entries: Array<{ guildId: string; age: number; expired: boolean }> = [];

  for (const [guildId, entry] of configCache.entries()) {
    const age = now - entry.cachedAt;
    entries.push({
      guildId,
      age,
      expired: age >= CACHE_TTL,
    });
  }

  return {
    size: configCache.size,
    entries,
  };
}

/**
 * Clean expired cache entries
 * Can be run periodically to free memory
 *
 * @returns Number of entries removed
 */
export function cleanExpiredCache(): number {
  const now = Date.now();
  let removed = 0;

  for (const [guildId, entry] of configCache.entries()) {
    if (now - entry.cachedAt >= CACHE_TTL) {
      configCache.delete(guildId);
      removed++;
    }
  }

  return removed;
}

/**
 * Preload config into cache
 * Useful for warming cache on bot startup
 *
 * @param guildId Guild ID
 */
export async function preloadCache(guildId: string): Promise<void> {
  await getConfig(guildId, true);
}

/**
 * Get all guild configs (admin only)
 *
 * @param limit Limit results
 * @param offset Offset for pagination
 * @returns Array of guild configs
 */
export async function getAllConfigs(
  limit: number = 100,
  offset: number = 0
): Promise<GuildXPConfig[]> {
  return await configRepo.getAllXPConfigs(limit, offset);
}
