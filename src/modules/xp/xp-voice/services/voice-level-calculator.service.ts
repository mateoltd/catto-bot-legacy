/**
 * Voice XP Level Calculator Service
 * Calculates levels based on XP using formula or table
 */

import type { GuildVoiceXPConfig } from '@prisma/client';
import type { VoiceLevelCalculation } from '../types/voice-xp.types.js';
import { VoiceLevelCurveType } from '../types/voice-xp.types.js';
import * as voiceXPRepository from '../repositories/voice-xp.repository.js';

export function calculateVoiceLevel(
  config: GuildVoiceXPConfig,
  currentXP: number
): VoiceLevelCalculation {
  if (config.levelCurveType === VoiceLevelCurveType.TABLE) {
    return calculateLevelFromTable(config, currentXP);
  } else {
    return calculateLevelFromFormula(config, currentXP);
  }
}

function calculateLevelFromFormula(
  config: GuildVoiceXPConfig,
  currentXP: number
): VoiceLevelCalculation {
  const base = config.formulaBase;
  const exponent = config.formulaExponent;
  const offset = config.formulaOffset;

  // Cumulative progression with epoch multipliers:
  // XP required for one level: base * level^exponent + offset * level + 100
  // Total XP for target level = sum(single-level XP from 1..targetLevel)
  let level = 0;
  let currentLevelXP = 0;

  while (true) {
    const xpForNextLevel = calculateSingleLevelXP(level + 1, base, exponent, offset);
    if (currentLevelXP + xpForNextLevel > currentXP) {
      break;
    }

    currentLevelXP += xpForNextLevel;
    level++;

    // Safety guard
    if (level > 10_000) {
      break;
    }
  }

  const nextLevelXP = currentLevelXP + calculateSingleLevelXP(level + 1, base, exponent, offset);
  const xpInCurrentLevel = currentXP - currentLevelXP;
  const xpNeededForLevel = nextLevelXP - currentLevelXP;
  const progress = xpNeededForLevel > 0 ? (xpInCurrentLevel / xpNeededForLevel) * 100 : 0;

  return {
    level,
    currentLevelXp: currentLevelXP,
    nextLevelXp: nextLevelXP,
    progress,
    xpIntoLevel: xpInCurrentLevel,
  };
}

function calculateSingleLevelXP(
  level: number,
  base: number,
  exponent: number,
  offset: number
): number {
  if (level <= 0) return 0;

  const baseRequirement = base * Math.pow(level, exponent) + offset * level + 100;
  const epochMultiplier = getEpochMultiplier(level);
  return Math.floor(baseRequirement * epochMultiplier);
}

function getEpochMultiplier(level: number): number {
  if (level <= 5) return 0.95; // onboarding
  if (level <= 12) return 1.2; // harder
  if (level <= 18) return 1.05; // breather
  if (level <= 28) return 1.35; // harder
  if (level <= 40) return 1.15; // breather
  return 1.5; // endgame climb
}

function calculateLevelFromTable(
  config: GuildVoiceXPConfig,
  currentXP: number
): VoiceLevelCalculation {
  const thresholds = config.tableThresholds;

  if (!thresholds || thresholds.length === 0) {
    return {
      level: 0,
      currentLevelXp: 0,
      nextLevelXp: 0,
      progress: 0,
      xpIntoLevel: 0,
    };
  }

  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (currentXP >= (thresholds[i] ?? 0)) {
      level = i + 1;
    } else {
      break;
    }
  }

  const currentLevelXP = level > 0 ? (thresholds[level - 1] ?? 0) : 0;
  const atMaximumLevel = level >= thresholds.length;
  const nextLevelXP = atMaximumLevel ? currentLevelXP : (thresholds[level] ?? currentLevelXP);
  const xpInCurrentLevel = currentXP - currentLevelXP;
  const xpNeededForLevel = nextLevelXP - currentLevelXP;
  const progress = atMaximumLevel
    ? 100
    : xpNeededForLevel > 0
      ? (xpInCurrentLevel / xpNeededForLevel) * 100
      : 0;

  return {
    level,
    currentLevelXp: currentLevelXP,
    nextLevelXp: nextLevelXP,
    progress,
    xpIntoLevel: xpInCurrentLevel,
  };
}

/**
 * Recalculates voice levels for all users in a guild using the current curve config.
 * Processes users in batches and only updates those whose level actually changed.
 */
export async function recalculateGuildVoiceLevels(
  guildId: string,
  config: GuildVoiceXPConfig
): Promise<{ processed: number; updated: number }> {
  const batchSize = 500;
  let offset = 0;
  let processed = 0;
  let updated = 0;

  while (true) {
    const users = await voiceXPRepository.getAllGuildVoiceUsers(guildId, batchSize, offset);

    if (users.length === 0) {
      break;
    }

    for (const user of users) {
      const newLevel = calculateVoiceLevel(config, user.xp).level;

      if (newLevel !== user.level) {
        await voiceXPRepository.updateUserVoiceLevel(guildId, user.userId, newLevel);
        updated++;
      }

      processed++;
    }

    if (users.length < batchSize) {
      break;
    }

    offset += batchSize;
  }

  return { processed, updated };
}
