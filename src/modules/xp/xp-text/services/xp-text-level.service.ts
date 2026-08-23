/**
 * XP Level Calculation Service
 * Handles level calculations based on guild configuration
 */

import type { GuildXPConfig } from '@prisma/client';
import type { LevelCalculation } from '../types/xp-text.types.js';
import { LevelCurveType } from '../types/xp-text.types.js';
import { calculateLevel, getLevelThresholds } from '../utils/level-curve.js';
import * as configService from './xp-text-config.service.js';

/**
 * Calculate level from total XP using guild's curve configuration
 *
 * @param guildId Guild ID
 * @param totalXp Total XP earned
 * @returns Complete level calculation
 */
export async function calculateLevelForGuild(
  guildId: string,
  totalXp: number
): Promise<LevelCalculation> {
  const config = await configService.getConfig(guildId);

  return calculateLevel(
    totalXp,
    config.levelCurveType as LevelCurveType,
    config.formulaBase,
    config.formulaExponent,
    config.formulaOffset,
    config.tableThresholds
  );
}

/**
 * Calculate level from total XP using provided config
 * Useful when config is already loaded
 *
 * @param config Guild XP configuration
 * @param totalXp Total XP earned
 * @returns Complete level calculation
 */
export function calculateLevelWithConfig(config: GuildXPConfig, totalXp: number): LevelCalculation {
  return calculateLevel(
    totalXp,
    config.levelCurveType as LevelCurveType,
    config.formulaBase,
    config.formulaExponent,
    config.formulaOffset,
    config.tableThresholds
  );
}

/**
 * Get XP thresholds for a specific level
 *
 * @param guildId Guild ID
 * @param level Target level
 * @returns Current and next level XP thresholds
 */
export async function getLevelThresholdsForGuild(
  guildId: string,
  level: number
): Promise<{ currentLevelXp: number; nextLevelXp: number }> {
  const config = await configService.getConfig(guildId);

  return getLevelThresholds(
    level,
    config.levelCurveType as LevelCurveType,
    config.formulaBase,
    config.formulaExponent,
    config.formulaOffset,
    config.tableThresholds
  );
}

/**
 * Calculate if user leveled up after XP gain
 *
 * @param config Guild XP configuration
 * @param oldXp Previous total XP
 * @param newXp New total XP
 * @returns Object with leveledUp boolean and levels
 */
export function checkLevelUp(
  config: GuildXPConfig,
  oldXp: number,
  newXp: number
): { leveledUp: boolean; oldLevel: number; newLevel: number } {
  const oldLevelCalc = calculateLevelWithConfig(config, oldXp);
  const newLevelCalc = calculateLevelWithConfig(config, newXp);

  return {
    leveledUp: newLevelCalc.level > oldLevelCalc.level,
    oldLevel: oldLevelCalc.level,
    newLevel: newLevelCalc.level,
  };
}

/**
 * Calculate XP needed to reach next level
 *
 * @param config Guild XP configuration
 * @param currentXp Current total XP
 * @returns XP needed for next level
 */
export function getXPToNextLevel(config: GuildXPConfig, currentXp: number): number {
  const levelCalc = calculateLevelWithConfig(config, currentXp);
  return levelCalc.nextLevelXp - currentXp;
}

/**
 * Recalculate level for a user based on current curve
 * Used when curve configuration changes
 *
 * @param guildId Guild ID
 * @param currentXp User's current XP
 * @returns New level
 */
export async function recalculateLevel(guildId: string, currentXp: number): Promise<number> {
  const levelCalc = await calculateLevelForGuild(guildId, currentXp);
  return levelCalc.level;
}
