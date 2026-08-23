/**
 * UserFlagService - Manages user flags for moderation context
 *
 * Flags provide additional context about users for moderators, such as
 * suspicious activity markers, trusted status, or raid participation.
 */

import { container } from '@sapphire/framework';
import type { GuildId, UserId } from '../domain/types.js';

/**
 * Available user flag types
 */
export type UserFlagType =
  | 'SUSPICIOUS' // Manual flag by mods
  | 'AUTO_FLAGGED' // Triggered by heuristics
  | 'RAID_PARTICIPANT' // Joined during raid
  | 'ALT_ACCOUNT' // Suspected alt
  | 'TRUSTED' // Manually trusted user
  | 'APPEALED'; // Has approved appeal

/**
 * User flag data
 */
export interface UserFlagData {
  id: string;
  guildId: GuildId;
  userId: UserId;
  flag: UserFlagType;
  reason: string | null;
  createdById: UserId;
  createdAt: Date;
  expiresAt: Date | null;
  active: boolean;
}

/**
 * Input for adding a flag
 */
export interface AddFlagInput {
  guildId: GuildId;
  userId: UserId;
  flag: UserFlagType;
  reason?: string;
  createdById: UserId;
  duration?: number; // seconds, for expiring flags
}

/**
 * Result from flag operations
 */
export interface FlagResult {
  success: boolean;
  flag?: UserFlagData;
  error?: string;
}

/**
 * UserFlagService - Handles user flag management
 */
class UserFlagServiceImpl {
  /**
   * Add a flag to a user
   */
  async addFlag(input: AddFlagInput): Promise<FlagResult> {
    try {
      const expiresAt = input.duration ? new Date(Date.now() + input.duration * 1000) : null;

      const flag = await container.prisma.userFlag.upsert({
        where: {
          guildId_userId_flag: {
            guildId: input.guildId,
            userId: input.userId,
            flag: input.flag,
          },
        },
        update: {
          reason: input.reason ?? null,
          createdById: input.createdById,
          createdAt: new Date(),
          expiresAt,
          active: true,
        },
        create: {
          guildId: input.guildId,
          userId: input.userId,
          flag: input.flag,
          reason: input.reason ?? null,
          createdById: input.createdById,
          expiresAt,
          active: true,
        },
      });

      return {
        success: true,
        flag: this.mapToFlagData(flag),
      };
    } catch (error) {
      container.logger.error('[UserFlagService] Error adding flag:', error);
      return {
        success: false,
        error: 'Failed to add flag',
      };
    }
  }

  /**
   * Remove a flag from a user
   */
  async removeFlag(guildId: GuildId, userId: UserId, flag: UserFlagType): Promise<FlagResult> {
    try {
      await container.prisma.userFlag.updateMany({
        where: {
          guildId,
          userId,
          flag,
          active: true,
        },
        data: {
          active: false,
        },
      });

      return { success: true };
    } catch (error) {
      container.logger.error('[UserFlagService] Error removing flag:', error);
      return {
        success: false,
        error: 'Failed to remove flag',
      };
    }
  }

  /**
   * Get active flags for a user
   */
  async getActiveFlags(guildId: GuildId, userId: UserId): Promise<UserFlagData[]> {
    // First, clean up expired flags
    await this.cleanupExpiredFlags(guildId, userId);

    const flags = await container.prisma.userFlag.findMany({
      where: {
        guildId,
        userId,
        active: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return flags.map((f) => this.mapToFlagData(f));
  }

  /**
   * Get all users with a specific flag
   */
  async listFlaggedUsers(
    guildId: GuildId,
    flag?: UserFlagType,
    limit: number = 50
  ): Promise<UserFlagData[]> {
    const where: Record<string, unknown> = {
      guildId,
      active: true,
    };

    if (flag) {
      where.flag = flag;
    }

    const flags = await container.prisma.userFlag.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return flags.map((f) => this.mapToFlagData(f));
  }

  /**
   * Check if a user has a specific flag
   */
  async hasFlag(guildId: GuildId, userId: UserId, flag: UserFlagType): Promise<boolean> {
    // Clean up expired first
    await this.cleanupExpiredFlags(guildId, userId);

    const existing = await container.prisma.userFlag.findUnique({
      where: {
        guildId_userId_flag: {
          guildId,
          userId,
          flag,
        },
      },
    });

    return existing?.active === true;
  }

  /**
   * Check if user is trusted
   */
  async isTrusted(guildId: GuildId, userId: UserId): Promise<boolean> {
    return this.hasFlag(guildId, userId, 'TRUSTED');
  }

  /**
   * Check if user is flagged as suspicious
   */
  async isSuspicious(guildId: GuildId, userId: UserId): Promise<boolean> {
    const flags = await this.getActiveFlags(guildId, userId);
    return flags.some((f) =>
      ['SUSPICIOUS', 'AUTO_FLAGGED', 'RAID_PARTICIPANT', 'ALT_ACCOUNT'].includes(f.flag)
    );
  }

  /**
   * Get flag summary for context display
   */
  async getFlagSummary(
    guildId: GuildId,
    userId: UserId
  ): Promise<{
    flags: string[];
    isTrusted: boolean;
    isSuspicious: boolean;
  }> {
    const activeFlags = await this.getActiveFlags(guildId, userId);
    const flagNames = activeFlags.map((f) => f.flag);

    return {
      flags: flagNames,
      isTrusted: flagNames.includes('TRUSTED'),
      isSuspicious: flagNames.some((f) =>
        ['SUSPICIOUS', 'AUTO_FLAGGED', 'RAID_PARTICIPANT', 'ALT_ACCOUNT'].includes(f)
      ),
    };
  }

  /**
   * Clean up expired flags for a user
   */
  private async cleanupExpiredFlags(guildId: GuildId, userId: UserId): Promise<void> {
    await container.prisma.userFlag.updateMany({
      where: {
        guildId,
        userId,
        active: true,
        expiresAt: {
          lte: new Date(),
        },
      },
      data: {
        active: false,
      },
    });
  }

  /**
   * Map database record to FlagData
   */
  private mapToFlagData(flag: {
    id: string;
    guildId: string;
    userId: string;
    flag: string;
    reason: string | null;
    createdById: string;
    createdAt: Date;
    expiresAt: Date | null;
    active: boolean;
  }): UserFlagData {
    return {
      id: flag.id,
      guildId: flag.guildId as GuildId,
      userId: flag.userId as UserId,
      flag: flag.flag as UserFlagType,
      reason: flag.reason,
      createdById: flag.createdById as UserId,
      createdAt: flag.createdAt,
      expiresAt: flag.expiresAt,
      active: flag.active,
    };
  }
}

// Export singleton instance
export const userFlagService = new UserFlagServiceImpl();
