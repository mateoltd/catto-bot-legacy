/**
 * Voice XP Queue Service
 * Manages BullMQ jobs for periodic voice XP awards
 */

import { Queue, Worker, type Job } from 'bullmq';
import { container } from '@sapphire/framework';
import { CONFIG } from '../../../../config.js';
import { awardPerMinuteXP } from './voice-xp-session.service.js';
import { getVoiceXPConfig } from './voice-xp-config.service.js';

interface VoiceXPJobData {
  guildId: string;
  timestamp: number;
}

class VoiceXPQueueService {
  private queue: Queue<VoiceXPJobData>;
  private worker: Worker<VoiceXPJobData>;
  private readonly QUEUE_NAME = 'voice-xp-awards';
  private readonly JOB_NAME = 'award-per-minute-xp';

  constructor() {
    const connection = {
      host: CONFIG.REDIS_HOST,
      port: CONFIG.REDIS_PORT,
      password: CONFIG.REDIS_PASSWORD,
      db: CONFIG.REDIS_DB,
    };

    // Create queue for adding jobs
    this.queue = new Queue<VoiceXPJobData>(this.QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, then 10s, then 20s
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100,
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    });

    // Create worker to process jobs
    this.worker = new Worker<VoiceXPJobData>(
      this.QUEUE_NAME,
      async (job: Job<VoiceXPJobData>) => this.processAward(job),
      {
        connection,
        concurrency: 3, // Process up to 3 guilds concurrently
      }
    );

    // Worker event handlers
    this.worker.on('completed', (job) => {
      container.logger.debug(
        `[Voice XP Queue] Job ${job.id} completed for guild ${job.data.guildId}`
      );
    });

    this.worker.on('failed', (job, err) => {
      container.logger.error(`[Voice XP Queue] Job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      container.logger.error('[Voice XP Queue] Worker error:', err);
    });

    container.logger.info('[Voice XP Queue] Service initialized');
  }

  /**
   * Process voice XP award for a guild
   */
  private async processAward(job: Job<VoiceXPJobData>): Promise<void> {
    const { guildId } = job.data;

    try {
      const awarded = await awardPerMinuteXP(guildId);

      if (awarded > 0) {
        container.logger.debug(
          `[Voice XP Queue] Awarded XP to ${awarded} user(s) in guild ${guildId}`
        );
      }
    } catch (error) {
      // If bot is not in the guild, remove the repeating job
      if (error instanceof Error && error.message.includes('Bot is not in guild')) {
        container.logger.warn(
          `[Voice XP Queue] Bot is no longer in guild ${guildId}, removing scheduled jobs`
        );
        // Remove all repeating jobs for this guild
        const repeatableJobs = await this.queue.getRepeatableJobs();
        for (const repeatJob of repeatableJobs) {
          if (repeatJob.key.includes(guildId)) {
            await this.queue.removeRepeatableByKey(repeatJob.key);
            container.logger.info(`[Voice XP Queue] Removed repeating job for guild ${guildId}`);
          }
        }
        return; // Don't re-throw, job is handled
      }

      container.logger.error(`[Voice XP Queue] Error awarding XP for guild ${guildId}:`, error);
      throw error; // Re-throw to trigger retry for other errors
    }
  }

  /**
   * Schedule repeating job for a guild
   * Awards XP every minute to users in voice channels
   *
   * Users receive XP awards:
   * - Every minute while staying in voice (PER_MINUTE mode)
   * - XP is stored in database every time it's awarded
   * - If a user stays for 15+ minutes without leaving, they'll have received 15+ XP awards
   * - This ensures XP is persisted even if bot restarts
   */
  public async scheduleGuildAwards(guildId: string): Promise<void> {
    try {
      // Add repeatable job that runs every minute
      await this.queue.add(
        this.JOB_NAME,
        {
          guildId,
          timestamp: Date.now(),
        },
        {
          repeat: {
            pattern: '* * * * *', // Every minute (cron format)
            // Optionally use 'every: 60000' for every 60 seconds
          },
          jobId: `voice-xp-${guildId}`, // Unique job ID per guild
        }
      );

      container.logger.info(`[Voice XP Queue] Scheduled per-minute XP awards for guild ${guildId}`);
    } catch (error) {
      container.logger.error(
        `[Voice XP Queue] Error scheduling awards for guild ${guildId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Remove repeating job for a guild
   */
  public async unscheduleGuildAwards(guildId: string): Promise<void> {
    try {
      await this.queue.removeRepeatableByKey(`${this.JOB_NAME}:voice-xp-${guildId}:* * * * *:`);
      container.logger.info(
        `[Voice XP Queue] Unscheduled per-minute XP awards for guild ${guildId}`
      );
    } catch (error) {
      container.logger.error(
        `[Voice XP Queue] Error unscheduling awards for guild ${guildId}:`,
        error
      );
    }
  }

  /**
   * Initialize repeating jobs for all guilds with voice XP enabled
   */
  public async initializeAllGuilds(): Promise<void> {
    try {
      const guilds = container.client.guilds.cache;
      let scheduled = 0;

      for (const [guildId] of guilds) {
        const config = await getVoiceXPConfig(guildId);

        // Only schedule if enabled and using PER_MINUTE mode
        if (config.enabled && config.xpMode === 'PER_MINUTE') {
          await this.scheduleGuildAwards(guildId);
          scheduled++;
        }
      }

      container.logger.info(
        `[Voice XP Queue] Initialized per-minute XP awards for ${scheduled}/${guilds.size} guild(s)`
      );
    } catch (error) {
      container.logger.error('[Voice XP Queue] Error initializing guild jobs:', error);
    }
  }

  /**
   * Gracefully shutdown queue and worker
   */
  public async shutdown(): Promise<void> {
    container.logger.info('[Voice XP Queue] Shutting down...');
    await this.worker.close();
    await this.queue.close();
    container.logger.info('[Voice XP Queue] Shutdown complete');
  }
}

// Export singleton instance
export const voiceXPQueue = new VoiceXPQueueService();
