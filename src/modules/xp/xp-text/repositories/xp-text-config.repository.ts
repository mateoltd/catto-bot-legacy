/**
 * XP Configuration Repository
 * Handles CRUD operations for GuildXPConfig
 */

import { container } from '@sapphire/framework';
import type { GuildXPConfig } from '@prisma/client';
import type { UpdateXPConfigDTO } from '../dtos/index.js';

/**
 * Get XP configuration for a guild
 * Creates default config if not exists
 *
 * @param guildId Guild ID
 * @returns Guild XP configuration
 */
export async function getXPConfig(guildId: string): Promise<GuildXPConfig> {
  return await container.prisma.guildXPConfig.upsert({
    where: { guildId },
    update: {},
    create: {
      guildId,
      enabled: true,
      cooldownSec: 60,
      xpMode: 'RANDOM',
      minXp: 15,
      maxXp: 25,
      fixedXp: 20,
      minMessageLength: 5,
      maxXpPerMinute: null,
      allowedChannels: [],
      ignoredChannels: [],
      ignoredRoles: [],
      announceLevelUp: true,
      announceChannelId: null,
      messageTemplate: '🎉 {user} reached level {level}!',
      embedEnabled: true,
      embedColor: 5793266,
      levelCurveType: 'FORMULA',
      formulaBase: 5.0,
      formulaExponent: 2.0,
      formulaOffset: 50.0,
      tableThresholds: [],
    },
  });
}

/**
 * Update XP configuration for a guild
 *
 * @param guildId Guild ID
 * @param data Update data
 * @returns Updated configuration
 */
export async function updateXPConfig(
  guildId: string,
  data: UpdateXPConfigDTO
): Promise<GuildXPConfig> {
  // Ensure config exists first
  await getXPConfig(guildId);

  // Debug log
  console.log('Updating XP config with data:', JSON.stringify(data, null, 2));

  const result = await container.prisma.guildXPConfig.update({
    where: { guildId },
    data,
  });

  console.log('Update result allowedChannels:', result.allowedChannels);

  return result;
}

/**
 * Delete XP configuration for a guild
 *
 * @param guildId Guild ID
 */
export async function deleteXPConfig(guildId: string): Promise<void> {
  await container.prisma.guildXPConfig.delete({
    where: { guildId },
  });
}

/**
 * Check if XP system is enabled for a guild
 *
 * @param guildId Guild ID
 * @returns True if enabled
 */
export async function isXPEnabled(guildId: string): Promise<boolean> {
  const config = await container.prisma.guildXPConfig.findUnique({
    where: { guildId },
    select: { enabled: true },
  });

  return config?.enabled ?? false;
}

/**
 * Get all guild configs (for admin purposes)
 *
 * @param limit Limit results (default: 100)
 * @param offset Offset for pagination (default: 0)
 * @returns Array of guild configs
 */
export async function getAllXPConfigs(
  limit: number = 100,
  offset: number = 0
): Promise<GuildXPConfig[]> {
  return await container.prisma.guildXPConfig.findMany({
    take: limit,
    skip: offset,
    orderBy: { updatedAt: 'desc' },
  });
}
