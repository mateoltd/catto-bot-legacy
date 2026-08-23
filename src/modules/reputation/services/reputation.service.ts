/**
 * Reputation Service
 * Handles all reputation and vouch-related operations
 */

import { PrismaClient, Prisma } from '@prisma/client';
import type { Guild, GuildMember } from 'discord.js';
import {
  VouchType,
  ReputationTier,
  REPUTATION_TIERS,
  VOUCH_CONFIG,
  type VouchData,
  type ReputationStats,
  type VouchValidation,
} from '../models/reputation.model.js';
import { EMOJI } from '#lib/discord/design/index.js';

export class ReputationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get or create user reputation record
   */
  async getOrCreateReputation(guildId: string, userId: string) {
    let reputation = await this.prisma.userReputation.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    if (!reputation) {
      reputation = await this.prisma.userReputation.create({
        data: {
          guildId,
          userId,
          reputationScore: 0,
          reputationTier: ReputationTier.BRONZE,
        },
      });
    }

    return reputation;
  }

  /**
   * Validate if a user can vouch for another user
   */
  async validateVouch(
    guild: Guild,
    giver: GuildMember,
    receiver: GuildMember,
    vouchType: VouchType
  ): Promise<VouchValidation> {
    // Can't vouch for yourself
    if (giver.id === receiver.id) {
      return {
        isValid: false,
        reason: `${EMOJI.STATUS.ERROR} You cannot vouch for yourself.`,
      };
    }

    // Can't vouch for bots
    if (receiver.user.bot) {
      return {
        isValid: false,
        reason: `${EMOJI.STATUS.ERROR} You cannot vouch for bots.`,
      };
    }

    // Check giver's account age
    const giverAccountAge = Date.now() - giver.user.createdAt.getTime();
    const minAccountAge = VOUCH_CONFIG.MIN_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000;
    if (giverAccountAge < minAccountAge) {
      return {
        isValid: false,
        reason: `${EMOJI.STATUS.ERROR} Your account must be at least ${VOUCH_CONFIG.MIN_ACCOUNT_AGE_DAYS} days old to vouch for others.`,
      };
    }

    // Check giver's server join age
    if (giver.joinedAt) {
      const serverAge = Date.now() - giver.joinedAt.getTime();
      const minServerAge = VOUCH_CONFIG.MIN_SERVER_AGE_DAYS * 24 * 60 * 60 * 1000;
      if (serverAge < minServerAge) {
        return {
          isValid: false,
          reason: `${EMOJI.STATUS.ERROR} You must be in this server for at least ${VOUCH_CONFIG.MIN_SERVER_AGE_DAYS} days to vouch for others.`,
        };
      }
    }

    const giverRep = await this.getOrCreateReputation(guild.id, giver.id);

    // Check general vouch cooldown
    if (giverRep.lastVouchGiven) {
      const cooldown = this.getCooldownForTier(giverRep.reputationTier as ReputationTier);
      const timeSinceLastVouch = Date.now() - giverRep.lastVouchGiven.getTime();

      if (timeSinceLastVouch < cooldown) {
        const remainingTime = cooldown - timeSinceLastVouch;
        const hours = Math.ceil(remainingTime / (60 * 60 * 1000));
        return {
          isValid: false,
          reason: `${EMOJI.STATUS.LOADING} You can vouch again in ${hours} hour(s).`,
          canVouchAgainAt: new Date(giverRep.lastVouchGiven.getTime() + cooldown),
        };
      }
    }

    // Check if they already vouched this person recently (same type)
    const recentVouch = await this.prisma.reputationVouch.findFirst({
      where: {
        guildId: guild.id,
        giverUserId: giver.id,
        receiverUserId: receiver.id,
        vouchType,
        createdAt: {
          gte: new Date(Date.now() - VOUCH_CONFIG.SAME_PERSON_COOLDOWN),
        },
      },
    });

    if (recentVouch) {
      const daysSince = Math.ceil(
        (Date.now() - recentVouch.createdAt.getTime()) / (24 * 60 * 60 * 1000)
      );
      const daysRemaining = 7 - daysSince;
      return {
        isValid: false,
        reason: `${EMOJI.STATUS.LOADING} You already vouched ${receiver.user.username} as ${vouchType}. You can vouch them again in ${daysRemaining} day(s).`,
      };
    }

    return { isValid: true };
  }

  /**
   * Submit a vouch
   */
  async submitVouch(guildId: string, vouchData: VouchData): Promise<void> {
    const { giverUserId, receiverUserId, vouchType, reason, contextType, contextId } = vouchData;

    // Get reputations
    const giverRep = await this.getOrCreateReputation(guildId, giverUserId);
    await this.getOrCreateReputation(guildId, receiverUserId);

    // Calculate vouch weight based on giver's tier
    const weight = this.getWeightForTier(giverRep.reputationTier as ReputationTier);

    // Calculate reputation points
    const points = VOUCH_CONFIG.VOUCH_POINTS[vouchType] * weight;

    // Create vouch record
    await this.prisma.reputationVouch.create({
      data: {
        guildId,
        giverUserId,
        receiverUserId,
        vouchType,
        reason,
        weight,
        contextType,
        contextId,
      },
    });

    // Update giver stats
    await this.prisma.userReputation.update({
      where: { guildId_userId: { guildId, userId: giverUserId } },
      data: {
        vouchesGiven: { increment: 1 },
        lastVouchGiven: new Date(),
      },
    });

    // Update receiver stats
    const updateData: Prisma.UserReputationUpdateInput = {
      vouchesReceived: { increment: 1 },
      reputationScore: { increment: points },
      lastActiveDate: new Date(),
    };

    // Increment specific vouch type counter
    switch (vouchType) {
      case VouchType.HELPFUL:
        updateData.helpfulVouches = { increment: 1 };
        break;
      case VouchType.FRIENDLY:
        updateData.friendlyVouches = { increment: 1 };
        break;
      case VouchType.SKILLED:
        updateData.skilledVouches = { increment: 1 };
        break;
      case VouchType.RELIABLE:
        updateData.reliableVouches = { increment: 1 };
        break;
    }

    const updatedRep = await this.prisma.userReputation.update({
      where: { guildId_userId: { guildId, userId: receiverUserId } },
      data: updateData,
    });

    // Check for tier upgrade
    await this.checkAndUpdateTier(guildId, receiverUserId, updatedRep.reputationScore);
  }

  /**
   * Get reputation stats for a user
   */
  async getReputationStats(guildId: string, userId: string): Promise<ReputationStats> {
    const rep = await this.getOrCreateReputation(guildId, userId);

    const currentTier = rep.reputationTier as ReputationTier;
    const nextTier = this.getNextTier(currentTier);

    let progressToNextTier = 0;
    if (nextTier) {
      const currentTierInfo = REPUTATION_TIERS[currentTier];
      const nextTierInfo = REPUTATION_TIERS[nextTier];
      const scoreInCurrentTier = rep.reputationScore - currentTierInfo.minScore;
      const scoreNeededForNext = nextTierInfo.minScore - currentTierInfo.minScore;
      progressToNextTier = Math.round((scoreInCurrentTier / scoreNeededForNext) * 100);
    }

    return {
      reputationScore: rep.reputationScore,
      vouchesReceived: rep.vouchesReceived,
      vouchesGiven: rep.vouchesGiven,
      currentTier,
      nextTier,
      progressToNextTier,
      breakdown: {
        helpful: rep.helpfulVouches,
        friendly: rep.friendlyVouches,
        skilled: rep.skilledVouches,
        reliable: rep.reliableVouches,
      },
    };
  }

  /**
   * Get vouch history for a user
   */
  async getVouchHistory(guildId: string, userId: string, type: 'received' | 'given' = 'received') {
    const where =
      type === 'received' ? { guildId, receiverUserId: userId } : { guildId, giverUserId: userId };

    return this.prisma.reputationVouch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  /**
   * Get reputation leaderboard
   */
  async getLeaderboard(guildId: string, limit: number = 10) {
    return this.prisma.userReputation.findMany({
      where: { guildId },
      orderBy: { reputationScore: 'desc' },
      take: limit,
    });
  }

  /**
   * Check and update tier if necessary
   */
  private async checkAndUpdateTier(guildId: string, userId: string, currentScore: number) {
    const rep = await this.prisma.userReputation.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    if (!rep) return;

    const currentTier = rep.reputationTier as ReputationTier;
    const newTier = this.calculateTier(currentScore);

    if (newTier !== currentTier) {
      await this.prisma.userReputation.update({
        where: { guildId_userId: { guildId, userId } },
        data: {
          reputationTier: newTier,
          tierReachedAt: new Date(),
        },
      });
    }
  }

  /**
   * Calculate tier based on reputation score
   */
  private calculateTier(score: number): ReputationTier {
    if (score >= REPUTATION_TIERS[ReputationTier.DIAMOND].minScore) return ReputationTier.DIAMOND;
    if (score >= REPUTATION_TIERS[ReputationTier.PLATINUM].minScore) return ReputationTier.PLATINUM;
    if (score >= REPUTATION_TIERS[ReputationTier.GOLD].minScore) return ReputationTier.GOLD;
    if (score >= REPUTATION_TIERS[ReputationTier.SILVER].minScore) return ReputationTier.SILVER;
    return ReputationTier.BRONZE;
  }

  /**
   * Get next tier
   */
  private getNextTier(currentTier: ReputationTier): ReputationTier | null {
    const tiers = [
      ReputationTier.BRONZE,
      ReputationTier.SILVER,
      ReputationTier.GOLD,
      ReputationTier.PLATINUM,
      ReputationTier.DIAMOND,
    ];
    const currentIndex = tiers.indexOf(currentTier);
    if (currentIndex < 0 || currentIndex >= tiers.length - 1) {
      return null;
    }
    return tiers[currentIndex + 1] ?? null;
  }

  /**
   * Get cooldown time for a tier
   */
  private getCooldownForTier(tier: ReputationTier): number {
    switch (tier) {
      case ReputationTier.DIAMOND:
        return VOUCH_CONFIG.DIAMOND_COOLDOWN;
      case ReputationTier.PLATINUM:
        return VOUCH_CONFIG.PLATINUM_COOLDOWN;
      case ReputationTier.GOLD:
        return VOUCH_CONFIG.GOLD_COOLDOWN;
      case ReputationTier.SILVER:
        return VOUCH_CONFIG.SILVER_COOLDOWN;
      default:
        return VOUCH_CONFIG.BASE_COOLDOWN;
    }
  }

  /**
   * Get vouch weight for a tier
   */
  private getWeightForTier(tier: ReputationTier): number {
    switch (tier) {
      case ReputationTier.DIAMOND:
        return VOUCH_CONFIG.DIAMOND_WEIGHT;
      case ReputationTier.PLATINUM:
        return VOUCH_CONFIG.PLATINUM_WEIGHT;
      case ReputationTier.GOLD:
        return VOUCH_CONFIG.GOLD_WEIGHT;
      case ReputationTier.SILVER:
        return VOUCH_CONFIG.SILVER_WEIGHT;
      default:
        return VOUCH_CONFIG.BASE_WEIGHT;
    }
  }

  /**
   * Get XP boost multiplier for a tier
   */
  getXPBoostForTier(tier: string): number {
    switch (tier) {
      case ReputationTier.DIAMOND:
        return 1.25;
      case ReputationTier.PLATINUM:
        return 1.15;
      case ReputationTier.GOLD:
        return 1.1;
      case ReputationTier.SILVER:
        return 1.05;
      default:
        return 1.0;
    }
  }
}
