/**
 * Level Curve Calculations
 * Handles formula-based and table-based XP curves
 */

import { LevelCurveType, LevelCalculation } from '../types/xp-text.types.js';

/**
 * Calculate XP required for a specific level using formula
 * Formula: base * (level ^ exponent) + (level * offset)
 *
 * Default formula (Mee6-style): 5 * (level^2) + 50 * level + 100
 *
 * @param level Target level
 * @param base Base multiplier (default: 5)
 * @param exponent Power exponent (default: 2)
 * @param offset Linear offset (default: 50)
 * @returns Total XP required to reach this level from level 0
 */
export function calculateFormulaXP(
  level: number,
  base: number = 5,
  exponent: number = 2,
  offset: number = 50
): number {
  if (level <= 0) return 0;

  let totalXp = 0;
  for (let i = 1; i <= level; i++) {
    // XP needed for each level
    const xpForLevel = Math.floor(base * Math.pow(i, exponent) + offset * i + 100);
    totalXp += xpForLevel;
  }

  return totalXp;
}

/**
 * Calculate XP required for a specific level using table
 *
 * @param level Target level
 * @param thresholds Array of cumulative XP thresholds [100, 255, 475, 770, ...]
 * @returns Total XP required to reach this level from level 0
 */
export function calculateTableXP(level: number, thresholds: number[]): number {
  if (level <= 0) return 0;

  // If level exceeds table, use the last threshold
  if (level > thresholds.length) {
    return thresholds[thresholds.length - 1] ?? 0;
  }

  return thresholds[level - 1] ?? 0;
}

/**
 * Calculate level from total XP using formula
 *
 * @param totalXp Total XP earned
 * @param base Base multiplier
 * @param exponent Power exponent
 * @param offset Linear offset
 * @returns Calculated level
 */
export function calculateLevelFromFormulaXP(
  totalXp: number,
  base: number = 5,
  exponent: number = 2,
  offset: number = 50
): number {
  if (totalXp <= 0) return 0;

  let level = 0;

  // Iterate until we exceed total XP
  while (true) {
    const nextLevelXp = calculateFormulaXP(level + 1, base, exponent, offset);
    if (nextLevelXp > totalXp) break;

    level++;

    // Safety check to prevent infinite loop
    if (level > 1000) break;
  }

  return level;
}

/**
 * Calculate level from total XP using table
 *
 * @param totalXp Total XP earned
 * @param thresholds Array of cumulative XP thresholds
 * @returns Calculated level
 */
export function calculateLevelFromTableXP(totalXp: number, thresholds: number[]): number {
  if (totalXp <= 0 || thresholds.length === 0) return 0;

  // Binary search for efficiency
  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    const threshold = thresholds[i];
    if (threshold !== undefined && totalXp >= threshold) {
      level = i + 1;
    } else {
      break;
    }
  }

  return level;
}

/**
 * Get XP thresholds for current and next level
 *
 * @param level Current level
 * @param curveType FORMULA or TABLE
 * @param base Formula base
 * @param exponent Formula exponent
 * @param offset Formula offset
 * @param thresholds Table thresholds
 * @returns Object with currentLevelXp and nextLevelXp
 */
export function getLevelThresholds(
  level: number,
  curveType: LevelCurveType,
  base: number,
  exponent: number,
  offset: number,
  thresholds: number[]
): { currentLevelXp: number; nextLevelXp: number } {
  if (curveType === LevelCurveType.FORMULA) {
    return {
      currentLevelXp: calculateFormulaXP(level, base, exponent, offset),
      nextLevelXp: calculateFormulaXP(level + 1, base, exponent, offset),
    };
  } else {
    return {
      currentLevelXp: calculateTableXP(level, thresholds),
      nextLevelXp: calculateTableXP(level + 1, thresholds),
    };
  }
}

/**
 * Calculate complete level information from total XP
 *
 * @param totalXp Total XP earned
 * @param curveType FORMULA or TABLE
 * @param base Formula base
 * @param exponent Formula exponent
 * @param offset Formula offset
 * @param thresholds Table thresholds
 * @returns Complete level calculation with progress
 */
export function calculateLevel(
  totalXp: number,
  curveType: LevelCurveType,
  base: number = 5,
  exponent: number = 2,
  offset: number = 50,
  thresholds: number[] = []
): LevelCalculation {
  // Calculate current level
  let level: number;
  if (curveType === LevelCurveType.FORMULA) {
    level = calculateLevelFromFormulaXP(totalXp, base, exponent, offset);
  } else {
    level = calculateLevelFromTableXP(totalXp, thresholds);
  }

  // Get XP thresholds
  const { currentLevelXp, nextLevelXp } = getLevelThresholds(
    level,
    curveType,
    base,
    exponent,
    offset,
    thresholds
  );

  // Calculate progress
  const xpIntoLevel = totalXp - currentLevelXp;
  const xpNeededForNextLevel = nextLevelXp - currentLevelXp;
  const progress = xpNeededForNextLevel > 0 ? xpIntoLevel / xpNeededForNextLevel : 1;

  return {
    level,
    currentLevelXp,
    nextLevelXp,
    progress: Math.min(Math.max(progress, 0), 1), // Clamp between 0 and 1
    xpIntoLevel,
  };
}

/**
 * Calculate XP needed to reach a target level
 *
 * @param currentXp Current total XP
 * @param targetLevel Target level
 * @param curveType FORMULA or TABLE
 * @param base Formula base
 * @param exponent Formula exponent
 * @param offset Formula offset
 * @param thresholds Table thresholds
 * @returns XP needed to reach target level
 */
export function calculateXPNeeded(
  currentXp: number,
  targetLevel: number,
  curveType: LevelCurveType,
  base: number = 5,
  exponent: number = 2,
  offset: number = 50,
  thresholds: number[] = []
): number {
  let targetXp: number;

  if (curveType === LevelCurveType.FORMULA) {
    targetXp = calculateFormulaXP(targetLevel, base, exponent, offset);
  } else {
    targetXp = calculateTableXP(targetLevel, thresholds);
  }

  return Math.max(0, targetXp - currentXp);
}

/**
 * Generate a preview of level thresholds
 * Useful for displaying level progression
 *
 * @param maxLevel Maximum level to generate (default: 20)
 * @param curveType FORMULA or TABLE
 * @param base Formula base
 * @param exponent Formula exponent
 * @param offset Formula offset
 * @param thresholds Table thresholds
 * @returns Array of { level, totalXp, xpNeeded }
 */
export function generateLevelPreview(
  maxLevel: number = 20,
  curveType: LevelCurveType = LevelCurveType.FORMULA,
  base: number = 5,
  exponent: number = 2,
  offset: number = 50,
  thresholds: number[] = []
): Array<{ level: number; totalXp: number; xpNeeded: number }> {
  const preview: Array<{ level: number; totalXp: number; xpNeeded: number }> = [];

  for (let level = 1; level <= maxLevel; level++) {
    const totalXp =
      curveType === LevelCurveType.FORMULA
        ? calculateFormulaXP(level, base, exponent, offset)
        : calculateTableXP(level, thresholds);

    const previousXp =
      level > 1
        ? curveType === LevelCurveType.FORMULA
          ? calculateFormulaXP(level - 1, base, exponent, offset)
          : calculateTableXP(level - 1, thresholds)
        : 0;

    preview.push({
      level,
      totalXp,
      xpNeeded: totalXp - previousXp,
    });
  }

  return preview;
}
