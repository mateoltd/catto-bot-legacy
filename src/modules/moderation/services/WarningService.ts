/**
 * WarningService - Warning system with escalation support
 *
 * Tracks warnings per user and provides escalation recommendations based on
 * configurable thresholds.
 */

import { container } from '@sapphire/framework';
import { ModAction } from '@prisma/client';
import type {
  GuildId,
  UserId,
  CaseNumber,
  WarningEscalationConfig,
  EscalationRecommendation,
  WarningResult,
  TimeRange,
} from '../domain/types.js';
import { moderationService } from './ModerationService.js';

/**
 * Default escalation thresholds
 */
const DEFAULT_ESCALATION_CONFIG: WarningEscalationConfig = {
  enabled: true,
  thresholds: [
    { count: 3, action: 'timeout', duration: 3600, message: '3 warnings - 1 hour timeout' },
    { count: 5, action: 'timeout', duration: 86400, message: '5 warnings - 24 hour timeout' },
    { count: 7, action: 'kick', message: '7 warnings - kick from server' },
    { count: 10, action: 'tempban', duration: 604800, message: '10 warnings - 7 day ban' },
  ],
};

/**
 * WarningService - Handles warning accumulation and escalation
 */
class WarningServiceImpl {
  /**
   * Add a warning to a user
   */
  async addWarning(
    guildId: GuildId,
    targetId: UserId,
    moderatorId: UserId,
    reason: string
  ): Promise<WarningResult> {
    // Create the warning case
    const result = await moderationService.createCase({
      guildId,
      action: ModAction.WARN,
      targetId,
      targetTag: '',
      moderatorId,
      moderatorTag: '',
      reason,
    });

    if (!result) {
      return {
        success: false,
        error: 'Failed to create warning case',
        userNotified: false,
        warningCount: 0,
      };
    }

    // Get current warning count
    const warningCount = await this.getWarningCount(guildId, targetId);

    // Check for escalation recommendation
    const escalation = await this.checkEscalation(guildId, targetId);

    return {
      success: true,
      caseNumber: result.caseNumber as CaseNumber,
      userNotified: false,
      warningCount,
      escalation: escalation ?? undefined,
    };
  }

  /**
   * Get total warning count for a user
   */
  async getWarningCount(guildId: GuildId, targetId: UserId, range?: TimeRange): Promise<number> {
    const where: Record<string, unknown> = {
      guildId,
      targetId,
      action: ModAction.WARN,
    };

    if (range) {
      where.createdAt = {
        gte: range.start,
        lte: range.end,
      };
    }

    const count = await container.prisma.modCase.count({ where });
    return count;
  }

  /**
   * Get warning count within a specific time period
   */
  async getRecentWarningCount(
    guildId: GuildId,
    targetId: UserId,
    daysBack: number = 30
  ): Promise<number> {
    const start = new Date();
    start.setDate(start.getDate() - daysBack);

    return this.getWarningCount(guildId, targetId, {
      start,
      end: new Date(),
    });
  }

  /**
   * List all warnings for a user
   */
  async listWarnings(guildId: GuildId, targetId: UserId, limit: number = 10) {
    const warnings = await container.prisma.modCase.findMany({
      where: {
        guildId,
        targetId,
        action: ModAction.WARN,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return warnings;
  }

  /**
   * Check if user should receive escalated action
   */
  async checkEscalation(
    guildId: GuildId,
    targetId: UserId
  ): Promise<EscalationRecommendation | null> {
    const config = await this.getEscalationConfig(guildId);

    if (!config.enabled || config.thresholds.length === 0) {
      return null;
    }

    const warningCount = await this.getWarningCount(guildId, targetId);

    // Find the highest threshold that applies
    const sortedThresholds = [...config.thresholds].sort((a, b) => b.count - a.count);

    for (const threshold of sortedThresholds) {
      if (warningCount >= threshold.count) {
        return {
          warningCount,
          recommendation: threshold.action,
          reason: threshold.message ?? `${warningCount} warnings reached`,
          suggestedDuration: threshold.duration,
        };
      }
    }

    return null;
  }

  /**
   * Get escalation config for a guild
   */
  async getEscalationConfig(guildId: GuildId): Promise<WarningEscalationConfig> {
    const config = await container.prisma.modConfig.findUnique({
      where: { guildId },
      select: { warningEscalation: true },
    });

    if (!config?.warningEscalation) {
      return DEFAULT_ESCALATION_CONFIG;
    }

    // Validate and parse the config
    const parsed = config.warningEscalation as unknown as WarningEscalationConfig;

    if (typeof parsed !== 'object' || !Array.isArray(parsed.thresholds)) {
      return DEFAULT_ESCALATION_CONFIG;
    }

    return {
      enabled: parsed.enabled ?? true,
      thresholds: parsed.thresholds.filter(
        (t) =>
          typeof t.count === 'number' && ['timeout', 'mute', 'kick', 'tempban'].includes(t.action)
      ),
    };
  }

  /**
   * Update escalation config for a guild
   */
  async updateEscalationConfig(
    guildId: GuildId,
    config: Partial<WarningEscalationConfig>
  ): Promise<void> {
    const currentConfig = await this.getEscalationConfig(guildId);

    // Serialize to plain JSON for Prisma compatibility
    const newConfig = JSON.parse(
      JSON.stringify({
        enabled: config.enabled ?? currentConfig.enabled,
        thresholds: config.thresholds ?? currentConfig.thresholds,
      })
    );

    await container.prisma.modConfig.upsert({
      where: { guildId },
      update: { warningEscalation: newConfig },
      create: {
        guildId,
        warningEscalation: newConfig,
      },
    });
  }

  /**
   * Get warning summary for a user (for panel display)
   */
  async getWarningSummary(
    guildId: GuildId,
    targetId: UserId
  ): Promise<{
    total: number;
    recent: number;
    escalation: EscalationRecommendation | null;
  }> {
    const [total, recent, escalation] = await Promise.all([
      this.getWarningCount(guildId, targetId),
      this.getRecentWarningCount(guildId, targetId, 30),
      this.checkEscalation(guildId, targetId),
    ]);

    return { total, recent, escalation };
  }
}

// Export singleton instance
export const warningService = new WarningServiceImpl();
