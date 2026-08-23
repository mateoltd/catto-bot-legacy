/**
 * Service for managing user-specific temp voice channel preferences
 */

import { PrismaClient } from '@prisma/client';

export interface UserPreferenceData {
  customName?: string | null;
  customUserLimit?: number | null;
  customBitrate?: number | null;
  customRegion?: string | null;
  preferLocked?: boolean;
  preferHidden?: boolean;
  allowedUserIds?: string[];
  deniedUserIds?: string[];
  trustedUserIds?: string[];
}

export class UserPreferencesService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get user preferences for a guild
   */
  async get(guildId: string, userId: string): Promise<UserPreferenceData | null> {
    const prefs = await this.prisma.tempVoiceUserPreference.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    if (!prefs) {
      return null;
    }

    return {
      customName: prefs.customName,
      customUserLimit: prefs.customUserLimit,
      customBitrate: prefs.customBitrate,
      customRegion: prefs.customRegion,
      preferLocked: prefs.preferLocked,
      preferHidden: prefs.preferHidden,
      allowedUserIds: Array.isArray(prefs.allowedUserIds) ? (prefs.allowedUserIds as string[]) : [],
      deniedUserIds: Array.isArray(prefs.deniedUserIds) ? (prefs.deniedUserIds as string[]) : [],
      trustedUserIds: Array.isArray(prefs.trustedUserIds) ? (prefs.trustedUserIds as string[]) : [],
    };
  }

  /**
   * Save or update user preferences
   */
  async save(guildId: string, userId: string, data: UserPreferenceData): Promise<void> {
    await this.prisma.tempVoiceUserPreference.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: {
        guildId,
        userId,
        ...data,
      },
      update: data,
    });
  }

  /**
   * Delete user preferences
   */
  async delete(guildId: string, userId: string): Promise<void> {
    await this.prisma.tempVoiceUserPreference.deleteMany({
      where: { guildId, userId },
    });
  }

  /**
   * Save preferences from an active channel
   */
  async saveFromChannel(
    guildId: string,
    userId: string,
    channelData: {
      customName?: string | null;
      customUserLimit?: number | null;
      customBitrate?: number | null;
      customRegion?: string | null;
      isLocked: boolean;
      isHidden: boolean;
      allowedUserIds?: string[];
      deniedUserIds?: string[];
      trustedUserIds?: string[];
    }
  ): Promise<void> {
    await this.save(guildId, userId, {
      customName: channelData.customName,
      customUserLimit: channelData.customUserLimit,
      customBitrate: channelData.customBitrate,
      customRegion: channelData.customRegion,
      preferLocked: channelData.isLocked,
      preferHidden: channelData.isHidden,
      allowedUserIds: channelData.allowedUserIds || [],
      deniedUserIds: channelData.deniedUserIds || [],
      trustedUserIds: channelData.trustedUserIds || [],
    });
  }
}
