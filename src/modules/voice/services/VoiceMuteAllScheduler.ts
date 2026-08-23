import { container } from '@sapphire/framework';
import { Queue, Worker, type Job } from 'bullmq';
import { MuteType } from '@prisma/client';
import { CONFIG } from '#config.js';
import { getJson, deleteJson, CacheKey } from '#lib/cache/index.js';
import { VoiceMuteAllStateSchema } from '../domain/types.js';
import { logVoiceMuteAllAction } from '#root/modules/moderation/discord/embeds/presets.js';

/**
 * Job data for mute-all expiry
 */
export interface MuteAllExpiryJobData {
  guildId: string;
  channelId: string;
}

/**
 * Queue name for mute-all expiry jobs
 */
const MUTE_ALL_QUEUE_NAME = 'voice-muteall-expire';

/**
 * VoiceMuteAllScheduler - Handles scheduling and processing of mute-all expiration
 */
export class VoiceMuteAllScheduler {
  private queue: Queue<MuteAllExpiryJobData> | null = null;
  private worker: Worker<MuteAllExpiryJobData> | null = null;
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
    this.queue = new Queue<MuteAllExpiryJobData>(MUTE_ALL_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: { count: 50 },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    // Create the worker
    this.worker = new Worker<MuteAllExpiryJobData>(
      MUTE_ALL_QUEUE_NAME,
      async (job) => this.processExpiry(job),
      {
        connection,
        concurrency: 3,
      }
    );

    // Worker event handlers
    this.worker.on('completed', (job) => {
      container.logger.info(
        `[VoiceMuteAllScheduler] Expiry job ${job.id} completed for channel ${job.data.channelId}`
      );
    });

    this.worker.on('failed', (job, err) => {
      container.logger.error(`[VoiceMuteAllScheduler] Expiry job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      container.logger.error('[VoiceMuteAllScheduler] Worker error:', err);
    });

    this.isInitialized = true;
    container.logger.info('[VoiceMuteAllScheduler] Initialized');
  }

  /**
   * Schedule expiry for a mute-all session.
   * Uses a stable jobId so re-scheduling replaces the existing job.
   */
  async scheduleExpiry(
    guildId: string,
    channelId: string,
    delayMs: number
  ): Promise<string | null> {
    if (!this.queue) {
      container.logger.error('[VoiceMuteAllScheduler] Queue not initialized');
      return null;
    }

    try {
      // Use stable jobId so re-enables replace the existing job
      const jobId = `muteall-${guildId}-${channelId}`;

      // Remove existing job if any (upsert behavior)
      const existingJob = await this.queue.getJob(jobId);
      if (existingJob) {
        await existingJob.remove();
      }

      const job = await this.queue.add(
        `muteall-expiry-${guildId}-${channelId}`,
        { guildId, channelId },
        {
          delay: delayMs,
          jobId,
        }
      );

      container.logger.info(
        `[VoiceMuteAllScheduler] Scheduled expiry for channel ${channelId} in guild ${guildId} in ${Math.round(delayMs / 1000)}s`
      );

      return job.id ?? null;
    } catch (error) {
      container.logger.error('[VoiceMuteAllScheduler] Failed to schedule expiry:', error);
      return null;
    }
  }

  /**
   * Cancel a scheduled expiry job
   */
  async cancelExpiry(guildId: string, channelId: string): Promise<boolean> {
    if (!this.queue) {
      container.logger.error('[VoiceMuteAllScheduler] Queue not initialized');
      return false;
    }

    try {
      const jobId = `muteall-${guildId}-${channelId}`;
      const job = await this.queue.getJob(jobId);

      if (job) {
        await job.remove();
        container.logger.info(
          `[VoiceMuteAllScheduler] Cancelled expiry for channel ${channelId} in guild ${guildId}`
        );
        return true;
      }

      return false;
    } catch (error) {
      container.logger.error('[VoiceMuteAllScheduler] Failed to cancel expiry:', error);
      return false;
    }
  }

  /**
   * Process an expiry job - disable mute-all for the channel
   */
  private async processExpiry(job: Job<MuteAllExpiryJobData>): Promise<void> {
    const { guildId, channelId } = job.data;

    container.logger.info(
      `[VoiceMuteAllScheduler] Processing expiry for channel ${channelId} in guild ${guildId}`
    );

    try {
      // Check if mute-all is still active
      const stateKey = CacheKey.voiceMuteAllState(guildId, channelId);
      const state = await getJson(stateKey, VoiceMuteAllStateSchema);

      if (!state?.enabled) {
        container.logger.info(
          `[VoiceMuteAllScheduler] Mute-all already disabled for channel ${channelId}, skipping`
        );
        return;
      }

      // Get the guild and channel
      const guild = await container.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        container.logger.warn(
          `[VoiceMuteAllScheduler] Guild ${guildId} not found, cleaning up state`
        );
        await this.cleanupState(guildId, channelId);
        return;
      }

      const channel = guild.channels.cache.get(channelId);
      const channelName = channel?.name ?? 'Unknown Channel';

      // Disable mute-all using the shared function
      const result = await disableMuteAllForChannel(guildId, channelId, guild);

      // Log to modlog
      await logVoiceMuteAllAction(guild, {
        enabled: false,
        channelId,
        channelName,
        moderatorId: container.client.user?.id ?? 'System',
        moderatorTag: container.client.user?.tag ?? 'System',
        affectedCount: result.unmutedCount,
        ignoredCount: result.ignoredCount,
      });

      container.logger.info(
        `[VoiceMuteAllScheduler] Expired mute-all for channel ${channelId}: unmuted ${result.unmutedCount}, ignored ${result.ignoredCount}`
      );
    } catch (error) {
      container.logger.error(
        `[VoiceMuteAllScheduler] Failed to process expiry for channel ${channelId}:`,
        error
      );
      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Clean up mute-all state keys without unmuting anyone
   */
  private async cleanupState(guildId: string, channelId: string): Promise<void> {
    const stateKey = CacheKey.voiceMuteAllState(guildId, channelId);
    const ignoreKey = CacheKey.voiceMuteAllIgnore(guildId, channelId);
    const affectedKey = CacheKey.voiceMuteAllAffected(guildId, channelId);

    await deleteJson(stateKey);
    await container.redis.del(ignoreKey);
    await container.redis.del(affectedKey);
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
    container.logger.info('[VoiceMuteAllScheduler] Shutdown complete');
  }
}

/**
 * Result of disabling mute-all for a channel
 */
export interface DisableMuteAllResult {
  unmutedCount: number;
  ignoredCount: number;
}

/**
 * Shared function to disable mute-all for a channel.
 * Called by both the button interaction handler and the expiry scheduler.
 */
export async function disableMuteAllForChannel(
  guildId: string,
  channelId: string,
  guild: import('discord.js').Guild
): Promise<DisableMuteAllResult> {
  const stateKey = CacheKey.voiceMuteAllState(guildId, channelId);
  const ignoreKey = CacheKey.voiceMuteAllIgnore(guildId, channelId);
  const affectedKey = CacheKey.voiceMuteAllAffected(guildId, channelId);

  // Get the ignorelist and affected sets
  const ignorelist = new Set(await container.redis.smembers(ignoreKey));
  const affectedUserIds = await container.redis.smembers(affectedKey);

  let unmutedCount = 0;
  let ignoredCount = 0;

  // Unmute all affected users (even if they've left the channel)
  for (const userId of affectedUserIds) {
    // Skip if in ignorelist (was already muted before toggle)
    if (ignorelist.has(userId)) {
      ignoredCount++;
      continue;
    }

    // Check if user has an active DB mute
    const hasDbMute = await hasActiveVoiceMute(guildId, userId);
    if (hasDbMute) {
      ignoredCount++;
      continue;
    }

    // Try to unmute the user
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member?.voice.serverMute) {
        await member.voice.setMute(false, 'Voice mute-all: session ended');
        unmutedCount++;
      }
    } catch (error) {
      container.logger.warn(`[VoiceMuteAll] Failed to unmute ${userId}:`, error);
    }
  }

  // Clear all mute-all state
  await deleteJson(stateKey);
  await container.redis.del(ignoreKey);
  await container.redis.del(affectedKey);

  return { unmutedCount, ignoredCount };
}

/**
 * Check if a user has an active voice mute in the database
 */
async function hasActiveVoiceMute(guildId: string, userId: string): Promise<boolean> {
  const count = await container.prisma.mute.count({
    where: {
      guildId,
      userId,
      active: true,
      type: { in: [MuteType.VOICE, MuteType.BOTH] },
    },
  });
  return count > 0;
}

// Export singleton instance
export const voiceMuteAllScheduler = new VoiceMuteAllScheduler();
