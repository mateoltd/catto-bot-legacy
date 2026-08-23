/**
 * ModerationQueueService - Manages the moderation review queue
 *
 * Allows moderators to queue items for review, claim them, and resolve them.
 * Items can come from user reports, automod triggers, or manual additions.
 */

import { container } from '@sapphire/framework';
import type { GuildId, UserId } from '../domain/types.js';

/**
 * Queue item status
 */
export type QueueStatus = 'pending' | 'claimed' | 'resolved';

/**
 * Queue item priority levels
 */
export enum QueuePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
}

/**
 * Queue item data
 */
export interface QueueItemData {
  id: string;
  guildId: GuildId;
  targetId: UserId;
  reportedById: UserId | null;
  reason: string;
  priority: QueuePriority;
  status: QueueStatus;
  claimedById: UserId | null;
  claimedAt: Date | null;
  resolvedAt: Date | null;
  resolution: string | null;
  createdAt: Date;
}

/**
 * Input for adding to queue
 */
export interface AddToQueueInput {
  guildId: GuildId;
  targetId: UserId;
  reportedById?: UserId;
  reason: string;
  priority?: QueuePriority;
}

/**
 * Result from queue operations
 */
export interface QueueResult {
  success: boolean;
  item?: QueueItemData;
  error?: string;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  pending: number;
  claimed: number;
  resolvedToday: number;
  avgResolutionTimeMs: number;
}

/**
 * ModerationQueueService - Handles queue management
 */
class ModerationQueueServiceImpl {
  /**
   * Add an item to the queue
   */
  async addToQueue(input: AddToQueueInput): Promise<QueueResult> {
    try {
      const item = await container.prisma.moderationQueueItem.create({
        data: {
          guildId: input.guildId,
          targetId: input.targetId,
          reportedById: input.reportedById ?? null,
          reason: input.reason,
          priority: input.priority ?? QueuePriority.NORMAL,
          status: 'pending',
        },
      });

      return {
        success: true,
        item: this.mapToQueueItemData(item),
      };
    } catch (error) {
      container.logger.error('[ModerationQueueService] Error adding to queue:', error);
      return {
        success: false,
        error: 'Failed to add item to queue',
      };
    }
  }

  /**
   * Claim a queue item for review
   */
  async claimItem(itemId: string, moderatorId: UserId): Promise<QueueResult> {
    try {
      const item = await container.prisma.moderationQueueItem.update({
        where: { id: itemId },
        data: {
          status: 'claimed',
          claimedById: moderatorId,
          claimedAt: new Date(),
        },
      });

      return {
        success: true,
        item: this.mapToQueueItemData(item),
      };
    } catch (error) {
      container.logger.error('[ModerationQueueService] Error claiming item:', error);
      return {
        success: false,
        error: 'Failed to claim item',
      };
    }
  }

  /**
   * Unclaim a queue item (return to pending)
   */
  async unclaimItem(itemId: string): Promise<QueueResult> {
    try {
      const item = await container.prisma.moderationQueueItem.update({
        where: { id: itemId },
        data: {
          status: 'pending',
          claimedById: null,
          claimedAt: null,
        },
      });

      return {
        success: true,
        item: this.mapToQueueItemData(item),
      };
    } catch (error) {
      container.logger.error('[ModerationQueueService] Error unclaiming item:', error);
      return {
        success: false,
        error: 'Failed to unclaim item',
      };
    }
  }

  /**
   * Resolve a queue item
   */
  async resolveItem(itemId: string, resolution: string): Promise<QueueResult> {
    try {
      const item = await container.prisma.moderationQueueItem.update({
        where: { id: itemId },
        data: {
          status: 'resolved',
          resolution,
          resolvedAt: new Date(),
        },
      });

      return {
        success: true,
        item: this.mapToQueueItemData(item),
      };
    } catch (error) {
      container.logger.error('[ModerationQueueService] Error resolving item:', error);
      return {
        success: false,
        error: 'Failed to resolve item',
      };
    }
  }

  /**
   * Get a queue item by ID
   */
  async getItem(itemId: string): Promise<QueueItemData | null> {
    const item = await container.prisma.moderationQueueItem.findUnique({
      where: { id: itemId },
    });

    return item ? this.mapToQueueItemData(item) : null;
  }

  /**
   * List queue items for a guild
   */
  async listQueue(
    guildId: GuildId,
    options: {
      status?: QueueStatus;
      priority?: QueuePriority;
      claimedById?: UserId;
      limit?: number;
    } = {}
  ): Promise<QueueItemData[]> {
    const { status, priority, claimedById, limit = 50 } = options;

    const where: Record<string, unknown> = { guildId };

    if (status) {
      where.status = status;
    }
    if (priority !== undefined) {
      where.priority = priority;
    }
    if (claimedById) {
      where.claimedById = claimedById;
    }

    const items = await container.prisma.moderationQueueItem.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: limit,
    });

    return items.map((i) => this.mapToQueueItemData(i));
  }

  /**
   * Get next pending item (highest priority, oldest)
   */
  async getNextPending(guildId: GuildId): Promise<QueueItemData | null> {
    const item = await container.prisma.moderationQueueItem.findFirst({
      where: {
        guildId,
        status: 'pending',
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    return item ? this.mapToQueueItemData(item) : null;
  }

  /**
   * Get queue statistics for a guild
   */
  async getQueueStats(guildId: GuildId): Promise<QueueStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pendingCount, claimedCount, resolvedToday] = await Promise.all([
      container.prisma.moderationQueueItem.count({
        where: { guildId, status: 'pending' },
      }),
      container.prisma.moderationQueueItem.count({
        where: { guildId, status: 'claimed' },
      }),
      container.prisma.moderationQueueItem.findMany({
        where: {
          guildId,
          status: 'resolved',
          resolvedAt: { gte: today },
        },
        select: {
          createdAt: true,
          resolvedAt: true,
        },
      }),
    ]);

    // Calculate average resolution time
    let avgResolutionTimeMs = 0;
    if (resolvedToday.length > 0) {
      const totalTime = resolvedToday.reduce((sum, item) => {
        if (item.resolvedAt) {
          return sum + (item.resolvedAt.getTime() - item.createdAt.getTime());
        }
        return sum;
      }, 0);
      avgResolutionTimeMs = totalTime / resolvedToday.length;
    }

    return {
      pending: pendingCount,
      claimed: claimedCount,
      resolvedToday: resolvedToday.length,
      avgResolutionTimeMs,
    };
  }

  /**
   * Get items for a specific target user
   */
  async getItemsForTarget(guildId: GuildId, targetId: UserId): Promise<QueueItemData[]> {
    const items = await container.prisma.moderationQueueItem.findMany({
      where: {
        guildId,
        targetId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((i) => this.mapToQueueItemData(i));
  }

  /**
   * Delete old resolved items (cleanup)
   */
  async cleanupOldItems(guildId: GuildId, daysOld: number = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const result = await container.prisma.moderationQueueItem.deleteMany({
      where: {
        guildId,
        status: 'resolved',
        resolvedAt: { lte: cutoff },
      },
    });

    return result.count;
  }

  /**
   * Map database record to QueueItemData
   */
  private mapToQueueItemData(item: {
    id: string;
    guildId: string;
    targetId: string;
    reportedById: string | null;
    reason: string;
    priority: number;
    status: string;
    claimedById: string | null;
    claimedAt: Date | null;
    resolvedAt: Date | null;
    resolution: string | null;
    createdAt: Date;
  }): QueueItemData {
    return {
      id: item.id,
      guildId: item.guildId as GuildId,
      targetId: item.targetId as UserId,
      reportedById: item.reportedById as UserId | null,
      reason: item.reason,
      priority: item.priority as QueuePriority,
      status: item.status as QueueStatus,
      claimedById: item.claimedById as UserId | null,
      claimedAt: item.claimedAt,
      resolvedAt: item.resolvedAt,
      resolution: item.resolution,
      createdAt: item.createdAt,
    };
  }
}

// Export singleton instance
export const moderationQueueService = new ModerationQueueServiceImpl();
