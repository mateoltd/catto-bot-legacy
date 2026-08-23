/**
 * Reward Integration for XP Systems
 * Automatically checks and applies rewards when users level up
 */

import { container } from '@sapphire/framework';
import type { Guild, GuildMember } from 'discord.js';
import { RewardService } from '../services/RewardService.js';
import type { RewardClaimResult } from '../../../lib/types/rewards.types.js';

export class RewardIntegration {
  private static rewardService: RewardService;

  /**
   * Initialize the reward service
   */
  static initialize() {
    if (!this.rewardService) {
      this.rewardService = new RewardService(container.prisma);
    }
  }

  /**
   * Check and apply rewards when a user levels up (TEXT XP)
   */
  static async onTextLevelUp(
    guildId: string,
    userId: string,
    newLevel: number,
    totalXp: number,
    guild: Guild,
    member: GuildMember
  ): Promise<RewardClaimResult[]> {
    this.initialize();

    try {
      // Check for eligible rewards
      const eligibility = await this.rewardService.checkEligibleRewards(
        guildId,
        userId,
        newLevel,
        'TEXT'
      );

      if (!eligibility.eligible || eligibility.rewards.length === 0) {
        return [];
      }

      // Auto-claim all eligible rewards
      const claimResults: RewardClaimResult[] = [];

      for (const reward of eligibility.rewards) {
        if (!reward.id) {
          container.logger.warn(
            `Reward ${reward.name} has no ID, skipping claim for ${userId} in ${guildId}`
          );
          continue;
        }

        try {
          const result = await this.rewardService.claimReward(
            guildId,
            userId,
            reward.id,
            newLevel,
            totalXp,
            guild,
            member
          );

          claimResults.push(result);

          if (result.success) {
            container.logger.info(`Reward claimed: ${reward.name} by ${userId} in ${guildId}`);
          } else {
            container.logger.warn(
              `Failed to claim reward: ${reward.name} for ${userId} in ${guildId}: ${result.error}`
            );
          }
        } catch (error) {
          container.logger.error(`Error claiming reward ${reward.id} for ${userId}:`, error);
        }
      }

      return claimResults;
    } catch (error) {
      container.logger.error(`Error processing text level-up rewards for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Check and apply rewards when a user levels up (VOICE XP)
   */
  static async onVoiceLevelUp(
    guildId: string,
    userId: string,
    newLevel: number,
    totalXp: number,
    guild: Guild,
    member: GuildMember
  ): Promise<RewardClaimResult[]> {
    this.initialize();

    try {
      // Check for eligible rewards
      const eligibility = await this.rewardService.checkEligibleRewards(
        guildId,
        userId,
        newLevel,
        'VOICE'
      );

      if (!eligibility.eligible || eligibility.rewards.length === 0) {
        return [];
      }

      // Auto-claim all eligible rewards
      const claimResults: RewardClaimResult[] = [];

      for (const reward of eligibility.rewards) {
        if (!reward.id) {
          container.logger.warn(
            `Voice reward ${reward.name} has no ID, skipping claim for ${userId} in ${guildId}`
          );
          continue;
        }

        try {
          const result = await this.rewardService.claimReward(
            guildId,
            userId,
            reward.id,
            newLevel,
            totalXp,
            guild,
            member
          );

          claimResults.push(result);

          if (result.success) {
            container.logger.info(
              `Voice reward claimed: ${reward.name} by ${userId} in ${guildId}`
            );
          } else {
            container.logger.warn(
              `Failed to claim voice reward: ${reward.name} for ${userId} in ${guildId}: ${result.error}`
            );
          }
        } catch (error) {
          container.logger.error(`Error claiming voice reward ${reward.id} for ${userId}:`, error);
        }
      }

      return claimResults;
    } catch (error) {
      container.logger.error(`Error processing voice level-up rewards for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get a summary of rewards to display in level-up messages
   */
  static formatRewardsSummary(results: RewardClaimResult[]): string | null {
    const successful = results.filter((r) => r.success);

    if (successful.length === 0) {
      return null;
    }

    const rewardLines = successful.map((r) => {
      const icon = r.reward.icon || '🎁';
      return `${icon} **${r.reward.name}**`;
    });

    return `\n\n**🎁 Rewards Unlocked:**\n${rewardLines.join('\n')}`;
  }

  /**
   * Check if a user should receive any rewards at their current level
   * (Useful for retroactive reward application)
   */
  static async checkMissingRewards(
    guildId: string,
    userId: string,
    currentLevel: number,
    currentXp: number,
    xpType: 'TEXT' | 'VOICE',
    guild: Guild,
    member: GuildMember
  ): Promise<RewardClaimResult[]> {
    this.initialize();

    try {
      const eligibility = await this.rewardService.checkEligibleRewards(
        guildId,
        userId,
        currentLevel,
        xpType
      );

      if (!eligibility.eligible) {
        return [];
      }

      const claimResults: RewardClaimResult[] = [];

      for (const reward of eligibility.rewards) {
        if (!reward.id) {
          container.logger.warn(
            `Reward ${reward.name} has no ID, skipping claim for ${userId} in ${guildId}`
          );
          continue;
        }

        const result = await this.rewardService.claimReward(
          guildId,
          userId,
          reward.id,
          currentLevel,
          currentXp,
          guild,
          member
        );

        claimResults.push(result);
      }

      return claimResults;
    } catch (error) {
      container.logger.error(`Error checking missing rewards for ${userId}:`, error);
      return [];
    }
  }
}
