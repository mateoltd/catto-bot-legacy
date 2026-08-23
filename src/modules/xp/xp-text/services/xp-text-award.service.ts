/**
 * XP Award Service
 * Handles XP awarding with validation, cooldown, and transaction safety
 */

import type { UserXP } from '@prisma/client';
import type { XPAwardResult, ValidationContext } from '../types/xp-text.types.js';
import { XPMode, LevelCurveType } from '../types/xp-text.types.js';
import * as xpRepo from '../repositories/xp-text.repository.js';
import * as configService from './xp-text-config.service.js';
import * as levelService from './xp-text-level.service.js';
import { validateXPAward, checkCooldown, calculateXPAmount } from '../utils/validation.js';
import { ReputationService } from '#modules/reputation/services/reputation.service.js';
import { container } from '@sapphire/framework';

/**
 * Award XP for a message
 * Main entry point for XP awarding with all validation and safety checks
 *
 * @param context Validation context with message/user info
 * @returns Award result with details
 */
export async function awardXP(context: ValidationContext): Promise<XPAwardResult> {
  // Get guild configuration
  const config = await configService.getConfig(context.guildId);

  // Validate if XP should be awarded (cast Prisma types to our enums)
  const validation = validateXPAward(context, {
    ...config,
    xpMode: config.xpMode as XPMode,
    levelCurveType: config.levelCurveType as LevelCurveType,
  });
  if (!validation.valid) {
    return {
      awarded: false,
      reason: validation.reason,
    };
  }

  // Check cooldown
  const userXP = await xpRepo.getUserXP(context.guildId, context.userId);
  const cooldownCheck = checkCooldown(userXP?.lastAwardAt ?? null, config.cooldownSec);

  if (!cooldownCheck.passed) {
    return {
      awarded: false,
      reason: `Cooldown active (${cooldownCheck.remaining}s remaining)`,
    };
  }

  // Get reputation boost multiplier
  let reputationMultiplier = 1.0;
  try {
    const reputationService = new ReputationService(container.prisma);
    const reputation = await reputationService.getOrCreateReputation(
      context.guildId,
      context.userId
    );
    reputationMultiplier = reputationService.getXPBoostForTier(reputation.reputationTier);
  } catch (error) {
    // If reputation system fails, continue with default multiplier
    container.logger.warn('Failed to get reputation multiplier for XP:', error);
  }

  // Calculate XP amount with reputation boost
  const xpGain = calculateXPAmount(
    config.xpMode as XPMode,
    config.minXp,
    config.maxXp,
    config.fixedXp,
    reputationMultiplier
  );

  // Calculate new level
  const currentXP = userXP?.xp ?? 0;
  const newXP = currentXP + xpGain;
  const newLevelCalc = levelService.calculateLevelWithConfig(config, newXP);

  // Award XP with transaction safety
  const result = await xpRepo.awardXPSafe(
    context.guildId,
    context.userId,
    xpGain,
    newLevelCalc.level
  );

  return {
    awarded: true,
    xpGained: xpGain,
    newXp: result.userXP.xp,
    newLevel: result.userXP.level,
    leveledUp: result.leveledUp,
    previousLevel: result.previousLevel,
  };
}

/**
 * Preview XP award without actually awarding
 * Useful for testing or displaying potential rewards
 *
 * @param context Validation context
 * @returns Award result preview
 */
export async function previewAward(context: ValidationContext): Promise<{
  wouldAward: boolean;
  reason: string;
  xpAmount?: number;
  cooldownRemaining?: number;
  filters: Record<string, boolean>;
}> {
  const config = await configService.getConfig(context.guildId);

  // Validate filters (cast Prisma types to our enums)
  const validation = validateXPAward(context, {
    ...config,
    xpMode: config.xpMode as XPMode,
    levelCurveType: config.levelCurveType as LevelCurveType,
  });

  if (!validation.valid) {
    return {
      wouldAward: false,
      reason: validation.reason ?? 'Validation failed',
      filters: validation.filters,
    };
  }

  // Check cooldown
  const userXP = await xpRepo.getUserXP(context.guildId, context.userId);
  const cooldownCheck = checkCooldown(userXP?.lastAwardAt ?? null, config.cooldownSec);

  if (!cooldownCheck.passed) {
    return {
      wouldAward: false,
      reason: `Cooldown active`,
      cooldownRemaining: cooldownCheck.remaining,
      filters: validation.filters,
    };
  }

  // Calculate XP amount
  const xpAmount = calculateXPAmount(
    config.xpMode as XPMode,
    config.minXp,
    config.maxXp,
    config.fixedXp
  );

  return {
    wouldAward: true,
    reason: 'Award would succeed',
    xpAmount,
    filters: validation.filters,
  };
}

/**
 * Check if user can receive XP right now
 * Quick check without full award logic
 *
 * @param guildId Guild ID
 * @param userId User ID
 * @returns True if can receive XP
 */
export async function canReceiveXP(guildId: string, userId: string): Promise<boolean> {
  const config = await configService.getConfig(guildId);

  if (!config.enabled) return false;

  const userXP = await xpRepo.getUserXP(guildId, userId);
  const cooldownCheck = checkCooldown(userXP?.lastAwardAt ?? null, config.cooldownSec);

  return cooldownCheck.passed;
}

/**
 * Get cooldown remaining for a user
 *
 * @param guildId Guild ID
 * @param userId User ID
 * @returns Seconds remaining (0 if no cooldown)
 */
export async function getCooldownRemaining(guildId: string, userId: string): Promise<number> {
  const config = await configService.getConfig(guildId);
  const userXP = await xpRepo.getUserXP(guildId, userId);

  const cooldownCheck = checkCooldown(userXP?.lastAwardAt ?? null, config.cooldownSec);
  return cooldownCheck.remaining;
}

/**
 * Manually award XP to a user (admin action)
 * Bypasses cooldown and validation
 *
 * @param guildId Guild ID
 * @param userId User ID
 * @param xpAmount XP to award (can be negative)
 * @param reason Reason for manual award
 * @returns Updated user XP
 */
export async function manualAwardXP(
  guildId: string,
  userId: string,
  xpAmount: number
): Promise<UserXP> {
  const userXP = await xpRepo.getUserXP(guildId, userId);
  const currentXP = userXP?.xp ?? 0;
  const newXP = Math.max(0, currentXP + xpAmount);

  const config = await configService.getConfig(guildId);
  const newLevelCalc = levelService.calculateLevelWithConfig(config, newXP);

  const result = await xpRepo.awardXPSafe(guildId, userId, xpAmount, newLevelCalc.level);

  return result.userXP;
}
