import { container } from '@sapphire/framework';
import { Queue, Worker, type Job } from 'bullmq';
import { ModAction } from '@prisma/client';
import type { GuildId, UserId, CaseNumber } from '../domain/types.js';
import { CONFIG } from '#config.js';
import { getSafeUserTag } from '#lib/discord/index.js';
import { ensureNonNull } from '#lib/utils.js';
import { logModAction } from '../discord/embeds/presets.js';

/**
 * Job data for tempban unban task
 */
export interface TempbanUnbanJobData {
  guildId: string;
  userId: string;
  caseNumber: number;
  reason: string;
}

/**
 * Queue name for tempban jobs
 */
const TEMPBAN_QUEUE_NAME = 'tempban-unban';

/**
 * TempbanScheduler - Handles scheduling and processing of tempban unban tasks
 */
export class TempbanScheduler {
  private queue: Queue<TempbanUnbanJobData> | null = null;
  private worker: Worker<TempbanUnbanJobData> | null = null;
  private isInitialized = false;

  /**
   * Initialize the scheduler (call once on bot startup)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const connection = {
      host: CONFIG.REDIS_HOST,
      port: CONFIG.REDIS_PORT,
      password: CONFIG.REDIS_PASSWORD,
      db: CONFIG.REDIS_DB,
    };

    // Create the queue
    this.queue = new Queue<TempbanUnbanJobData>(TEMPBAN_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: { count: 100 },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    // Create the worker
    this.worker = new Worker<TempbanUnbanJobData>(
      TEMPBAN_QUEUE_NAME,
      async (job) => this.processUnban(job),
      {
        connection,
        concurrency: 5,
      }
    );

    // Worker event handlers
    this.worker.on('completed', (job) => {
      container.logger.info(
        `[TempbanScheduler] Unban job ${job.id} completed for user ${job.data.userId}`
      );
    });

    this.worker.on('failed', (job, err) => {
      container.logger.error(`[TempbanScheduler] Unban job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      container.logger.error('[TempbanScheduler] Worker error:', err);
    });

    this.isInitialized = true;
    container.logger.info('[TempbanScheduler] Initialized');

    // Recover orphaned tempbans from database (handles Redis data loss or missed expirations)
    await this.recoverOrphanedTempbans();
  }

  /**
   * Recover tempbans that may have been orphaned due to Redis data loss or bot downtime.
   * This ensures all pending tempbans have corresponding jobs in the queue.
   */
  private async recoverOrphanedTempbans(): Promise<void> {
    try {
      const now = new Date();

      // Find all tempban cases that haven't been unbanned yet
      // We identify tempbans by looking for TEMPBAN cases with expiresAt set
      const pendingTempbans = await container.prisma.modCase.findMany({
        where: {
          action: 'TEMPBAN',
          expiresAt: { not: null },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (pendingTempbans.length === 0) {
        container.logger.info('[TempbanScheduler] No tempbans to check for recovery');
        return;
      }

      // Get all delayed jobs currently in the queue
      const delayedJobs = (await this.queue?.getDelayed()) ?? [];
      const existingJobKeys = new Set(
        delayedJobs.map((job) => `${job.data.guildId}-${job.data.userId}`)
      );

      // For each tempban, check if the user is still banned and if we have a job
      let recovered = 0;
      let expired = 0;

      for (const tempbanCase of pendingTempbans) {
        const expiresAt = ensureNonNull(
          tempbanCase.expiresAt,
          'TempbanScheduler.ts > recoverOrphanedTempbans > tempbanCase > expiresAt'
        );
        const jobKey = `${tempbanCase.guildId}-${tempbanCase.targetId}`;

        // Skip if we already have a job for this user in this guild
        if (existingJobKeys.has(jobKey)) {
          continue;
        }

        // Check if user is still banned
        try {
          const guild = await container.client.guilds.fetch(tempbanCase.guildId).catch(() => null);
          if (!guild) continue;

          const ban = await guild.bans.fetch(tempbanCase.targetId).catch(() => null);
          if (!ban) {
            // User is not banned anymore - they were already unbanned
            continue;
          }

          // Check if there's a more recent UNBAN case for this user
          const unbanCase = await container.prisma.modCase.findFirst({
            where: {
              guildId: tempbanCase.guildId,
              targetId: tempbanCase.targetId,
              action: 'UNBAN',
              createdAt: { gt: tempbanCase.createdAt },
            },
          });

          if (unbanCase) {
            // User was already unbanned after this tempban
            continue;
          }

          // User is still banned and we have no job - schedule unban
          const reason = tempbanCase.reason ?? 'No reason provided';

          if (expiresAt <= now) {
            // Tempban has already expired - process immediately
            container.logger.info(
              `[TempbanScheduler] Processing expired tempban case #${tempbanCase.caseNumber} for user ${tempbanCase.targetId}`
            );
            await this.scheduleUnban(
              tempbanCase.guildId as GuildId,
              tempbanCase.targetId as UserId,
              tempbanCase.caseNumber,
              reason,
              0 // Process immediately
            );
            expired++;
          } else {
            // Tempban is still active - schedule for future
            const delayMs = expiresAt.getTime() - now.getTime();
            container.logger.info(
              `[TempbanScheduler] Recovering tempban case #${tempbanCase.caseNumber} for user ${tempbanCase.targetId} (expires in ${Math.round(delayMs / 1000)}s)`
            );
            await this.scheduleUnban(
              tempbanCase.guildId as GuildId,
              tempbanCase.targetId as UserId,
              tempbanCase.caseNumber,
              reason,
              delayMs
            );
            recovered++;
          }

          // Add to set to avoid duplicate scheduling
          existingJobKeys.add(jobKey);
        } catch (error) {
          container.logger.error(
            `[TempbanScheduler] Error checking tempban case #${tempbanCase.caseNumber}:`,
            error
          );
        }
      }

      container.logger.info(
        `[TempbanScheduler] Recovery complete: ${recovered} rescheduled, ${expired} expired (processed immediately)`
      );
    } catch (error) {
      container.logger.error('[TempbanScheduler] Failed to recover orphaned tempbans:', error);
    }
  }

  /**
   * Schedule an unban for a tempbanned user
   */
  async scheduleUnban(
    guildId: GuildId,
    userId: UserId,
    caseNumber: number,
    reason: string,
    delayMs: number
  ): Promise<string | null> {
    if (!this.queue) {
      container.logger.error('[TempbanScheduler] Queue not initialized');
      return null;
    }

    try {
      const job = await this.queue.add(
        `unban-${guildId}-${userId}`,
        {
          guildId,
          userId,
          caseNumber,
          reason,
        },
        {
          delay: delayMs,
          jobId: `tempban-${guildId}-${userId}-${Date.now()}`,
        }
      );

      container.logger.info(
        `[TempbanScheduler] Scheduled unban for user ${userId} in guild ${guildId} in ${delayMs}ms`
      );

      return job.id ?? null;
    } catch (error) {
      container.logger.error('[TempbanScheduler] Failed to schedule unban:', error);
      return null;
    }
  }

  /**
   * Cancel a scheduled unban
   */
  async cancelUnban(guildId: GuildId, userId: UserId): Promise<boolean> {
    if (!this.queue) {
      container.logger.error('[TempbanScheduler] Queue not initialized');
      return false;
    }

    try {
      // Find and remove delayed jobs for this user
      const delayed = await this.queue.getDelayed();
      for (const job of delayed) {
        if (job.data.guildId === guildId && job.data.userId === userId) {
          await job.remove();
          container.logger.info(
            `[TempbanScheduler] Cancelled unban for user ${userId} in guild ${guildId}`
          );
          return true;
        }
      }
      return false;
    } catch (error) {
      container.logger.error('[TempbanScheduler] Failed to cancel unban:', error);
      return false;
    }
  }

  /**
   * Process an unban job
   */
  private async processUnban(job: Job<TempbanUnbanJobData>): Promise<void> {
    const { guildId, userId, caseNumber, reason } = job.data;

    container.logger.info(
      `[TempbanScheduler] Processing unban for user ${userId} in guild ${guildId}`
    );

    try {
      // Get the guild
      const guild = await container.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        container.logger.warn(`[TempbanScheduler] Guild ${guildId} not found, skipping unban`);
        return;
      }

      // Attempt to unban
      await guild.members.unban(userId, `Tempban expired (Case #${caseNumber}): ${reason}`);

      // Create unban case with resolved user tag
      const lastCase = await container.prisma.modCase.findFirst({
        where: { guildId },
        orderBy: { caseNumber: 'desc' },
      });

      // Get a proper user tag (not "Unknown#0000")
      const userTag = await getSafeUserTag(userId);
      const newCaseNumber = (lastCase?.caseNumber ?? 0) + 1;

      await container.prisma.modCase.create({
        data: {
          caseNumber: newCaseNumber,
          guildId,
          action: 'UNBAN',
          targetId: userId,
          targetTag: userTag,
          moderatorId: container.client.user?.id ?? 'System',
          moderatorTag: container.client.user?.tag ?? 'System',
          reason: `Automatic unban - Tempban expired (Case #${caseNumber})`,
        },
      });

      // Log to mod channel
      await logModAction(
        guild,
        ModAction.UNBAN,
        { id: userId, tag: userTag },
        'System',
        `Automatic unban - Tempban expired (Case #${caseNumber})`,
        newCaseNumber as CaseNumber,
        undefined,
        { automatic: true }
      );

      container.logger.info(
        `[TempbanScheduler] Successfully unbanned user ${userId} in guild ${guildId}`
      );
    } catch (error) {
      container.logger.error(`[TempbanScheduler] Failed to unban user ${userId}:`, error);
      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Get pending unbans count
   */
  async getPendingCount(): Promise<number> {
    if (!this.queue) return 0;
    return this.queue.getDelayedCount();
  }

  /**
   * Shutdown the scheduler gracefully
   */
  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
    this.isInitialized = false;
    container.logger.info('[TempbanScheduler] Shutdown complete');
  }
}

// Export singleton instance
export const tempbanScheduler = new TempbanScheduler();
