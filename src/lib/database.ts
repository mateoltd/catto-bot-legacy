/**
 * Example Prisma Integration with Discord Bot
 *
 * This file demonstrates how to use Prisma with your Discord bot.
 * You can import these functions in your commands and listeners.
 */

import { Prisma } from '@prisma/client';
import { container } from '@sapphire/framework';
import type { Guild as DiscordGuild, User as DiscordUser } from 'discord.js';

/**
 * Store or update guild information in the database
 */
export async function saveGuild(guild: DiscordGuild, language = 'en-US') {
  return await container.prisma.guild.upsert({
    where: { guildId: guild.id },
    update: {
      name: guild.name,
      updatedAt: new Date(),
    },
    create: {
      guildId: guild.id,
      name: guild.name,
      language,
      settings: {
        prefix: '!',
      },
    },
  });
}

/**
 * Get guild from database
 */
export async function getGuild(guildId: string) {
  return await container.prisma.guild.findUnique({
    where: { guildId },
    include: { users: true },
  });
}

/**
 * Update guild language
 */
export async function updateGuildLanguage(guildId: string, language: string) {
  return await container.prisma.guild.update({
    where: { guildId },
    data: { language },
  });
}

/**
 * Store or update user information
 */
export async function saveUser(user: DiscordUser, guildId?: string) {
  const guildRecord = guildId
    ? await container.prisma.guild.findUnique({ where: { guildId } })
    : null;

  return await container.prisma.user.upsert({
    where: { userId: user.id },
    update: {
      username: user.username,
      updatedAt: new Date(),
    },
    create: {
      userId: user.id,
      username: user.username,
      guildId: guildRecord?.id,
    },
  });
}

/**
 * Get user from database
 */
export async function getUser(userId: string) {
  return await container.prisma.user.findUnique({
    where: { userId },
    include: { guild: true },
  });
}

/**
 * Log an event to the database
 */
export async function createLog(
  level: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  return await container.prisma.log.create({
    data: {
      level,
      message,
      ...(metadata && { metadata: metadata as Prisma.InputJsonValue }),
    },
  });
}

/**
 * Get recent logs
 */
export async function getRecentLogs(limit = 100) {
  return await container.prisma.log.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get all users in a guild
 */
export async function getGuildUsers(guildId: string) {
  const guild = await container.prisma.guild.findUnique({
    where: { guildId },
    include: { users: true },
  });

  return guild?.users || [];
}

/**
 * Delete guild and all related data
 */
export async function deleteGuild(guildId: string) {
  // Due to cascade delete, this will also delete all related users
  return await container.prisma.guild.delete({
    where: { guildId },
  });
}

/**
 * Get database statistics
 */
export async function getStats() {
  const [guildCount, userCount, logCount] = await Promise.all([
    container.prisma.guild.count(),
    container.prisma.user.count(),
    container.prisma.log.count(),
  ]);

  return {
    guilds: guildCount,
    users: userCount,
    logs: logCount,
  };
}
