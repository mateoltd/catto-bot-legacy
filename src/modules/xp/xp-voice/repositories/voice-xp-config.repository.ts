/**
 * Voice XP Configuration Repository
 */

import { container } from '@sapphire/framework';
import type { GuildVoiceXPConfig } from '@prisma/client';
import type { UpdateVoiceXPConfigDTO } from '../dtos/index.js';

export async function getVoiceXPConfig(guildId: string): Promise<GuildVoiceXPConfig> {
  // First, ensure the guild exists in the database
  const guild = await container.client.guilds.fetch(guildId).catch(() => null);

  // If we can't fetch the guild, the bot is not in it - check if it exists in DB
  if (!guild) {
    // Try to get existing config without creating one
    const existingConfig = await container.prisma.guildVoiceXPConfig.findUnique({
      where: { guildId },
    });

    if (existingConfig) {
      return existingConfig;
    }

    // Bot is not in the guild and no config exists - throw error
    throw new Error(`Bot is not in guild ${guildId}`);
  }

  // Guild exists, ensure it's in the database
  await container.prisma.guild.upsert({
    where: { guildId },
    update: {
      name: guild.name,
      updatedAt: new Date(),
    },
    create: {
      guildId: guild.id,
      name: guild.name,
      language: 'en-US',
      settings: {
        prefix: '!',
      },
    },
  });

  return await container.prisma.guildVoiceXPConfig.upsert({
    where: { guildId },
    update: {},
    create: {
      guildId,
      enabled: true,
      xpPerMinute: 5,
      minSessionMinutes: 1,
      xpMode: 'PER_MINUTE',
      allowedChannels: [],
      ignoredChannels: [],
      awardMuted: false,
      awardDeafened: false,
      awardStreaming: true,
      awardVideo: true,
      ignoreAfkChannel: true,
      antiFarmDampeningEnabled: false,
      antiFarmDampeningMultiplier: 0.35,
      antiFarmMinimumParticipants: 2,
      ignoredRoles: [],
      announceLevelUp: true,
      announceChannelId: null,
      messageTemplate: '🎤 {user} reached voice level {level}!',
      embedEnabled: true,
      embedColor: 5814783,
      levelCurveType: 'FORMULA',
      formulaBase: 5.0,
      formulaExponent: 2.0,
      formulaOffset: 50.0,
      tableThresholds: [],
    },
  });
}

export async function updateVoiceXPConfig(
  guildId: string,
  data: UpdateVoiceXPConfigDTO
): Promise<GuildVoiceXPConfig> {
  await getVoiceXPConfig(guildId);

  return await container.prisma.guildVoiceXPConfig.update({
    where: { guildId },
    data,
  });
}

export async function deleteVoiceXPConfig(guildId: string): Promise<void> {
  await container.prisma.guildVoiceXPConfig.delete({
    where: { guildId },
  });
}

export async function isVoiceXPEnabled(guildId: string): Promise<boolean> {
  const config = await getVoiceXPConfig(guildId);
  return config.enabled;
}

export async function getAllVoiceXPConfigs(
  limit: number = 100,
  offset: number = 0
): Promise<GuildVoiceXPConfig[]> {
  return await container.prisma.guildVoiceXPConfig.findMany({
    take: limit,
    skip: offset,
  });
}
