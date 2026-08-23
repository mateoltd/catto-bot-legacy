import { container } from '@sapphire/framework';
import { AppealStatus } from '@prisma/client';
import type { GuildId, AppealId, ModAppealInput, ModAppealResolveInput } from '../domain/types.js';
import { asAppealId } from '../domain/types.js';

/**
 * Service result type for appeal operations
 */
export interface AppealResult {
  success: boolean;
  appealId?: AppealId;
  error?: string;
}

/**
 * Appeal data returned from queries
 */
export interface AppealData {
  id: AppealId;
  guildId: string;
  targetId: string;
  caseId: string | null;
  createdById: string;
  reason: string;
  status: AppealStatus;
  resolution: string | null;
  resolvedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

/**
 * AppealsService - Handles moderation appeals
 */
export class AppealsService {
  /**
   * Create a new appeal
   */
  async createAppeal(input: ModAppealInput): Promise<AppealResult> {
    try {
      // Check for existing pending appeal
      const existing = await container.prisma.modAppeal.findFirst({
        where: {
          guildId: input.guildId,
          targetId: input.targetId,
          status: AppealStatus.PENDING,
        },
      });

      if (existing) {
        return { success: false, error: 'User already has a pending appeal' };
      }

      const appeal = await container.prisma.modAppeal.create({
        data: {
          guildId: input.guildId,
          targetId: input.targetId,
          createdById: input.createdById,
          caseId: input.caseId,
          reason: input.reason,
          status: AppealStatus.PENDING,
        },
      });

      return { success: true, appealId: asAppealId(appeal.id) };
    } catch (error) {
      container.logger.error('Failed to create appeal:', error);
      return { success: false, error: 'Failed to create appeal' };
    }
  }

  /**
   * List appeals for a guild with optional status filter
   */
  async listAppeals(guildId: GuildId, status?: AppealStatus): Promise<AppealData[]> {
    const appeals = await container.prisma.modAppeal.findMany({
      where: {
        guildId,
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return appeals.map(this.mapAppealToData);
  }

  /**
   * Get a single appeal by ID
   */
  async getAppeal(appealId: AppealId): Promise<AppealData | null> {
    const appeal = await container.prisma.modAppeal.findUnique({
      where: { id: appealId },
    });

    if (!appeal) return null;
    return this.mapAppealToData(appeal);
  }

  /**
   * Get pending appeals count for a guild
   */
  async getPendingCount(guildId: GuildId): Promise<number> {
    return container.prisma.modAppeal.count({
      where: {
        guildId,
        status: AppealStatus.PENDING,
      },
    });
  }

  /**
   * Resolve an appeal (approve or deny)
   */
  async resolveAppeal(
    appealId: AppealId,
    guildId: GuildId,
    input: ModAppealResolveInput
  ): Promise<AppealResult> {
    try {
      const appeal = await container.prisma.modAppeal.findUnique({
        where: { id: appealId },
      });

      if (!appeal) {
        return { success: false, error: 'Appeal not found' };
      }

      if (appeal.guildId !== guildId) {
        return { success: false, error: 'Appeal does not belong to this guild' };
      }

      if (appeal.status !== AppealStatus.PENDING) {
        return { success: false, error: 'Appeal has already been resolved' };
      }

      await container.prisma.modAppeal.update({
        where: { id: appealId },
        data: {
          status: input.status,
          resolution: input.resolution,
          resolvedById: input.resolvedById,
          resolvedAt: new Date(),
        },
      });

      return { success: true, appealId };
    } catch (error) {
      container.logger.error('Failed to resolve appeal:', error);
      return { success: false, error: 'Failed to resolve appeal' };
    }
  }

  /**
   * Get appeals for a specific user
   */
  async getUserAppeals(guildId: GuildId, targetId: string): Promise<AppealData[]> {
    const appeals = await container.prisma.modAppeal.findMany({
      where: {
        guildId,
        targetId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return appeals.map(this.mapAppealToData);
  }

  private mapAppealToData(appeal: {
    id: string;
    guildId: string;
    targetId: string;
    caseId: string | null;
    createdById: string;
    reason: string;
    status: AppealStatus;
    resolution: string | null;
    resolvedById: string | null;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
  }): AppealData {
    return {
      id: asAppealId(appeal.id),
      guildId: appeal.guildId,
      targetId: appeal.targetId,
      caseId: appeal.caseId,
      createdById: appeal.createdById,
      reason: appeal.reason,
      status: appeal.status,
      resolution: appeal.resolution,
      resolvedById: appeal.resolvedById,
      createdAt: appeal.createdAt,
      updatedAt: appeal.updatedAt,
      resolvedAt: appeal.resolvedAt,
    };
  }
}

// Export singleton instance
export const appealsService = new AppealsService();
