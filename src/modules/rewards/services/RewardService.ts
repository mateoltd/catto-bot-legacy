/**
 * Reward Service
 * Handles all reward-related operations including claiming, checking eligibility, and applying rewards
 */

import { PrismaClient, LevelReward, UserRewardClaim, Prisma } from '@prisma/client';
import type { Guild, GuildMember } from 'discord.js';
import {
  RewardType,
  XPType,
  RewardStatus,
  type LevelRewardConfig,
  type RewardClaimResult,
  type RewardCheckResult,
  type RoleRewardData,
  type PermissionRewardData,
  type ChannelAccessRewardData,
  type CurrencyRewardData,
  type MultiplierRewardData,
  type AnnouncementRewardData,
  RewardData,
} from '../../../lib/types/rewards.types.js';

export class RewardService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Check which rewards a user is eligible for at their current level
   */
  async checkEligibleRewards(
    guildId: string,
    userId: string,
    level: number,
    xpType: 'TEXT' | 'VOICE'
  ): Promise<RewardCheckResult> {
    // Get all rewards for this guild at or below the user's level
    const potentialRewards = await this.prisma.levelReward.findMany({
      where: {
        guildId,
        level: { lte: level },
        enabled: true,
        OR: [{ xpType: xpType }, { xpType: 'BOTH' }],
      },
      orderBy: [{ level: 'asc' }, { priority: 'desc' }],
    });

    // Get already claimed rewards
    const claimedRewards = await this.prisma.userRewardClaim.findMany({
      where: {
        guildId,
        userId,
        status: RewardStatus.ACTIVE,
      },
      select: {
        rewardId: true,
      },
    });

    const claimedIds = new Set(claimedRewards.map((c) => c.rewardId));

    // Filter to only unclaimed, eligible rewards
    const eligibleRewards = potentialRewards.filter((reward) => {
      // Skip if already claimed and it's one-time
      if (reward.oneTime && claimedIds.has(reward.id)) {
        return false;
      }

      // Check if previous level rewards are required
      if (reward.requiresPrevious) {
        const previousRewards = potentialRewards.filter(
          (r) => r.level < reward.level && r.xpType === reward.xpType
        );
        const allPreviousClaimed = previousRewards.every((r) => claimedIds.has(r.id));
        if (!allPreviousClaimed) {
          return false;
        }
      }

      return true;
    });

    return {
      eligible: eligibleRewards.length > 0,
      rewards: eligibleRewards.map(this.mapToConfig),
      alreadyClaimed: Array.from(claimedIds),
    };
  }

  /**
   * Claim and apply a reward for a user
   */
  async claimReward(
    guildId: string,
    userId: string,
    rewardId: string,
    level: number,
    xp: number,
    discordGuild: Guild,
    discordMember: GuildMember
  ): Promise<RewardClaimResult> {
    const reward = await this.prisma.levelReward.findUnique({
      where: { id: rewardId },
    });

    if (!reward || reward.guildId !== guildId) {
      return {
        success: false,
        reward: {
          guildId,
          level: 0,
          xpType: XPType.TEXT,
          rewardType: RewardType.ROLE_ADD,
          rewardData: {} as RoleRewardData,
          name: 'Unknown',
        },
        error: 'Reward not found',
      };
    }

    // Check if already claimed
    if (reward.oneTime) {
      const existingClaim = await this.prisma.userRewardClaim.findUnique({
        where: {
          guildId_userId_rewardId: {
            guildId,
            userId,
            rewardId,
          },
        },
      });

      if (existingClaim && existingClaim.status === RewardStatus.ACTIVE) {
        return {
          success: false,
          reward: this.mapToConfig(reward),
          error: 'Reward already claimed',
        };
      }
    }

    // Apply the reward based on type
    const applyResult = await this.applyReward(reward, discordGuild, discordMember);

    if (!applyResult.success) {
      return {
        success: false,
        reward: this.mapToConfig(reward),
        error: applyResult.error,
      };
    }

    // Record the claim
    await this.prisma.userRewardClaim.create({
      data: {
        guildId,
        userId,
        rewardId,
        levelAtClaim: level,
        xpAtClaim: xp,
        status: RewardStatus.ACTIVE,
      },
    });

    return {
      success: true,
      reward: this.mapToConfig(reward),
      details: applyResult.details,
    };
  }

  /**
   * Apply the actual reward effects
   */
  private async applyReward(
    reward: LevelReward,
    guild: Guild,
    member: GuildMember
  ): Promise<{
    success: boolean;
    error?: string;
    details?: Record<string, Prisma.InputJsonValue>;
  }> {
    const rewardData = reward.rewardData;

    try {
      switch (reward.rewardType) {
        case RewardType.ROLE_ADD:
        case RewardType.ROLE_STACK: {
          const data = rewardData as unknown as RoleRewardData;
          const role = await guild.roles.fetch(data.roleId);
          if (!role) {
            return { success: false, error: 'Role not found' };
          }
          await member.roles.add(role);
          return {
            success: true,
            details: { rolesAdded: [role.id] },
          };
        }

        case RewardType.ROLE_REPLACE: {
          const data = rewardData as unknown as RoleRewardData;
          const role = await guild.roles.fetch(data.roleId);
          if (!role) {
            return { success: false, error: 'Role not found' };
          }

          // Remove old roles if specified
          if (data.removeRoles && data.removeRoles.length > 0) {
            await member.roles.remove(data.removeRoles);
          }

          await member.roles.add(role);
          return {
            success: true,
            details: {
              rolesAdded: [role.id],
              rolesRemoved: data.removeRoles || [],
            },
          };
        }

        case RewardType.ROLE_REMOVE: {
          const data = rewardData as unknown as RoleRewardData;
          const role = await guild.roles.fetch(data.roleId);
          if (!role) {
            return { success: false, error: 'Role not found' };
          }
          await member.roles.remove(role);
          return {
            success: true,
            details: { rolesRemoved: [role.id] },
          };
        }

        case RewardType.PERMISSION_GRANT: {
          const data = rewardData as unknown as PermissionRewardData;
          // This would need to be implemented based on your permission system
          // Could use channel overwrites or custom permission tracking
          return {
            success: true,
            details: { permissionsGranted: data.permissions },
          };
        }

        case RewardType.CHANNEL_ACCESS: {
          const data = rewardData as unknown as ChannelAccessRewardData;
          const channelsUnlocked: string[] = [];

          for (const channelId of data.channelIds) {
            const channel = await guild.channels.fetch(channelId);
            if (channel && 'permissionOverwrites' in channel) {
              await channel.permissionOverwrites.create(member, {
                ViewChannel: data.action === 'ADD',
                Connect: data.action === 'ADD' && channel.isVoiceBased(),
              });
              channelsUnlocked.push(channelId);
            }
          }

          return {
            success: true,
            details: { channelsUnlocked },
          };
        }

        case RewardType.CURRENCY_GRANT: {
          const data = rewardData as unknown as CurrencyRewardData;
          // This would integrate with your economy system
          // For now, just record the intent
          return {
            success: true,
            details: { currencyAwarded: data.amount },
          };
        }

        case RewardType.XP_MULTIPLIER: {
          const data = rewardData as unknown as MultiplierRewardData;
          // This would be tracked in a separate multipliers table
          // or as metadata in the user's XP record
          return {
            success: true,
            details: { multiplierApplied: data.multiplier },
          };
        }

        case RewardType.ANNOUNCEMENT: {
          const data = rewardData as unknown as AnnouncementRewardData;
          // Send announcement to specified channel
          const channel = data.channelId ? await guild.channels.fetch(data.channelId) : null;

          if (channel && channel.isTextBased()) {
            const message = data.message
              .replace('{user}', member.toString())
              .replace('{level}', String(reward.level));

            if (data.embedConfig) {
              await channel.send({
                content: data.mentionUser ? member.toString() : undefined,
                embeds: [
                  {
                    title: data.embedConfig.title,
                    description: data.embedConfig.description || message,
                    color: data.embedConfig.color,
                    thumbnail: data.embedConfig.thumbnail
                      ? { url: data.embedConfig.thumbnail }
                      : undefined,
                    footer: data.embedConfig.footer ? { text: data.embedConfig.footer } : undefined,
                  },
                ],
              });
            } else {
              await channel.send(message);
            }
          }

          return { success: true };
        }

        default:
          return {
            success: false,
            error: `Unsupported reward type: ${reward.rewardType}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all rewards configured for a guild
   */
  async getGuildRewards(guildId: string): Promise<LevelRewardConfig[]> {
    const rewards = await this.prisma.levelReward.findMany({
      where: { guildId },
      orderBy: [{ level: 'asc' }, { priority: 'desc' }],
    });

    return rewards.map(this.mapToConfig);
  }

  /**
   * Create a new reward
   */
  async createReward(config: LevelRewardConfig): Promise<LevelRewardConfig> {
    const reward = await this.prisma.levelReward.create({
      data: {
        guildId: config.guildId,
        level: config.level,
        xpType: config.xpType,
        rewardType: config.rewardType,
        rewardData: config.rewardData as unknown as Prisma.InputJsonValue,
        name: config.name,
        description: config.description,
        icon: config.icon,
        oneTime: config.oneTime ?? true,
        stackable: config.stackable ?? false,
        requiresPrevious: config.requiresPrevious ?? false,
        priority: config.priority ?? 0,
        enabled: config.enabled ?? true,
      },
    });

    return this.mapToConfig(reward);
  }

  /**
   * Update an existing reward
   */
  async updateReward(
    rewardId: string,
    updates: Partial<LevelRewardConfig>
  ): Promise<LevelRewardConfig> {
    const reward = await this.prisma.levelReward.update({
      where: { id: rewardId },
      data: {
        level: updates.level,
        xpType: updates.xpType,
        rewardType: updates.rewardType,
        rewardData: updates.rewardData as unknown as Prisma.InputJsonValue,
        name: updates.name,
        description: updates.description,
        icon: updates.icon,
        oneTime: updates.oneTime,
        stackable: updates.stackable,
        requiresPrevious: updates.requiresPrevious,
        priority: updates.priority,
        enabled: updates.enabled,
      },
    });

    return this.mapToConfig(reward);
  }

  /**
   * Delete a reward
   */
  async deleteReward(rewardId: string): Promise<void> {
    await this.prisma.levelReward.delete({
      where: { id: rewardId },
    });
  }

  /**
   * Get all rewards claimed by a user
   */
  async getUserRewards(guildId: string, userId: string): Promise<UserRewardClaim[]> {
    return this.prisma.userRewardClaim.findMany({
      where: {
        guildId,
        userId,
      },
      include: {
        reward: true,
      },
      orderBy: {
        claimedAt: 'desc',
      },
    });
  }

  /**
   * Map Prisma model to config interface
   */
  private mapToConfig(reward: LevelReward): LevelRewardConfig {
    return {
      id: reward.id,
      guildId: reward.guildId,
      level: reward.level,
      xpType: reward.xpType as XPType,
      rewardType: reward.rewardType as RewardType,
      rewardData: reward.rewardData as unknown as RewardData,
      name: reward.name,
      description: reward.description ?? undefined,
      icon: reward.icon ?? undefined,
      oneTime: reward.oneTime,
      stackable: reward.stackable,
      requiresPrevious: reward.requiresPrevious,
      priority: reward.priority,
      enabled: reward.enabled,
    };
  }
}
