import { container } from '@sapphire/framework';
import { Queue, Worker, type Job } from 'bullmq';
import { MuteType, ModAction } from '@prisma/client';
import type { GuildMember } from 'discord.js';
import type { GuildId, UserId, CaseNumber } from '../domain/types.js';
import { asGuildId } from '../domain/types.js';
import { CONFIG } from '#config.js';
import { getSafeUserTag } from '#lib/discord/index.js';
import { getJson, CacheKey } from '#lib/cache/index.js';
import { VoiceMuteAllStateSchema, VOICE_CACHE_TTL } from '#root/modules/voice/domain/types.js';
import { logModAction } from '../discord/embeds/presets.js';
import { ensureNonNull } from '#lib/utils.js';

/**
 * Job data for mute unmute task
 */
export interface MuteUnmuteJobData {
  muteId: string;
  guildId: string;
  userId: string;
  type: MuteType;
}

/**
 * Queue name for mute unmute jobs
 */
const MUTE_QUEUE_NAME = 'mod-unmute';

/**
 * MuteScheduler - Handles scheduling and processing of mute expiration tasks
 */
export class MuteScheduler {
  private queue: Queue<MuteUnmuteJobData> | null = null;
  private worker: Worker<MuteUnmuteJobData> | null = null;
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
    this.queue = new Queue<MuteUnmuteJobData>(MUTE_QUEUE_NAME, {
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
    this.worker = new Worker<MuteUnmuteJobData>(
      MUTE_QUEUE_NAME,
      async (job) => this.processUnmute(job),
      {
        connection,
        concurrency: 5,
      }
    );

    // Worker event handlers
    this.worker.on('completed', (job) => {
      container.logger.info(
        `[MuteScheduler] Unmute job ${job.id} completed for user ${job.data.userId} (${job.data.type})`
      );
    });

    this.worker.on('failed', (job, err) => {
      container.logger.error(`[MuteScheduler] Unmute job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      container.logger.error('[MuteScheduler] Worker error:', err);
    });

    this.isInitialized = true;
    container.logger.info('[MuteScheduler] Initialized');

    // Recover orphaned mutes from database (handles Redis data loss or missed expirations)
    await this.recoverOrphanedMutes();
  }

  /**
   * Recover mutes that may have been orphaned due to Redis data loss or bot downtime.
   * This ensures all active mutes with expirations have corresponding jobs in the queue.
   */
  private async recoverOrphanedMutes(): Promise<void> {
    try {
      const now = new Date();

      // Find all active mutes with expiration times
      const activeMutes = await container.prisma.mute.findMany({
        where: {
          active: true,
          expiresAt: { not: null },
        },
      });

      if (activeMutes.length === 0) {
        container.logger.info('[MuteScheduler] No active mutes to recover');
        return;
      }

      // Get all delayed jobs currently in the queue
      const delayedJobs = (await this.queue?.getDelayed()) ?? [];
      const existingJobMuteIds = new Set(delayedJobs.map((job) => job.data.muteId));

      let recovered = 0;
      let expired = 0;

      for (const mute of activeMutes) {
        const expiresAt = ensureNonNull(
          mute.expiresAt,
          'MuteScheduler > recoverOrphanedMutes(117): mute.expiresAt'
        );

        // Skip if job already exists for this mute
        if (existingJobMuteIds.has(mute.id)) {
          continue;
        }

        if (expiresAt <= now) {
          // Mute has already expired - process immediately
          container.logger.info(
            `[MuteScheduler] Processing expired mute ${mute.id} for user ${mute.userId}`
          );
          await this.scheduleUnmute(
            mute.id,
            mute.guildId as GuildId,
            mute.userId as UserId,
            mute.type,
            0 // Process immediately
          );
          expired++;
        } else {
          // Mute is still active - schedule for future expiration
          const delayMs = expiresAt.getTime() - now.getTime();
          container.logger.info(
            `[MuteScheduler] Recovering mute ${mute.id} for user ${mute.userId} (expires in ${Math.round(delayMs / 1000)}s)`
          );
          await this.scheduleUnmute(
            mute.id,
            mute.guildId as GuildId,
            mute.userId as UserId,
            mute.type,
            delayMs
          );
          recovered++;
        }
      }

      container.logger.info(
        `[MuteScheduler] Recovery complete: ${recovered} rescheduled, ${expired} expired (processed immediately)`
      );
    } catch (error) {
      container.logger.error('[MuteScheduler] Failed to recover orphaned mutes:', error);
    }
  }

  /**
   * Schedule an unmute for a muted user
   */
  async scheduleUnmute(
    muteId: string,
    guildId: GuildId,
    userId: UserId,
    type: MuteType,
    delayMs: number
  ): Promise<string | null> {
    if (!this.queue) {
      container.logger.error('[MuteScheduler] Queue not initialized');
      return null;
    }

    try {
      const job = await this.queue.add(
        `unmute-${guildId}-${userId}-${type}`,
        {
          muteId,
          guildId,
          userId,
          type,
        },
        {
          delay: delayMs,
          jobId: `mute-${muteId}-${Date.now()}`,
        }
      );

      container.logger.info(
        `[MuteScheduler] Scheduled unmute for user ${userId} (${type}) in guild ${guildId} in ${delayMs}ms`
      );

      return job.id ?? null;
    } catch (error) {
      container.logger.error('[MuteScheduler] Failed to schedule unmute:', error);
      return null;
    }
  }

  /**
   * Cancel a scheduled unmute
   */
  async cancelUnmute(guildId: GuildId, userId: UserId, type: MuteType): Promise<boolean> {
    if (!this.queue) {
      container.logger.error('[MuteScheduler] Queue not initialized');
      return false;
    }

    try {
      // Find and remove delayed jobs for this user and type
      const delayed = await this.queue.getDelayed();
      for (const job of delayed) {
        if (job.data.guildId === guildId && job.data.userId === userId && job.data.type === type) {
          await job.remove();
          container.logger.info(
            `[MuteScheduler] Cancelled unmute for user ${userId} (${type}) in guild ${guildId}`
          );
          return true;
        }
      }
      return false;
    } catch (error) {
      container.logger.error('[MuteScheduler] Failed to cancel unmute:', error);
      return false;
    }
  }

  /**
   * Process an unmute job
   */
  private async processUnmute(job: Job<MuteUnmuteJobData>): Promise<void> {
    const { muteId, guildId, userId, type } = job.data;

    container.logger.info(
      `[MuteScheduler] Processing unmute for user ${userId} (${type}) in guild ${guildId}`
    );

    try {
      // Check if mute is still active
      const mute = await container.prisma.mute.findUnique({
        where: { id: muteId },
      });

      if (!mute || !mute.active) {
        container.logger.info(`[MuteScheduler] Mute ${muteId} is no longer active, skipping`);
        return;
      }

      // Get the guild
      const guild = await container.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        container.logger.warn(`[MuteScheduler] Guild ${guildId} not found, skipping unmute`);
        return;
      }

      // Get the member
      const member = await guild.members.fetch(userId).catch(() => null);

      // Get mod config for role
      const config = await container.prisma.modConfig.findUnique({
        where: { guildId },
      });

      // Remove text mute role if applicable
      if ((type === MuteType.TEXT || type === MuteType.BOTH) && member) {
        const mutedRole = config?.mutedTextRole || config?.muteRoleId;
        if (mutedRole) {
          const role = await guild.roles.fetch(mutedRole).catch(() => null);
          if (role && member.roles.cache.has(role.id)) {
            await member.roles.remove(role, 'Mute expired');
          }
        }
      }

      // Remove voice mute if applicable (use setMute, not setDeaf)
      if ((type === MuteType.VOICE || type === MuteType.BOTH) && member?.voice.channel) {
        if (member.voice.serverMute) {
          const brandedGuildId = asGuildId(guildId);
          const shouldSuppress = await this.shouldSuppressVoiceUnmute(brandedGuildId, member);

          if (shouldSuppress) {
            await this.deferVoiceUnmuteForMuteAll(brandedGuildId, member);
            container.logger.info(
              `[MuteScheduler] Suppressed voice unmute for ${userId} (mute-all active in channel ${member.voice.channelId})`
            );
          } else {
            await member.voice.setMute(false, 'Mute expired');
          }
        }
      }

      // Mark mute as inactive
      await container.prisma.mute.update({
        where: { id: muteId },
        data: { active: false },
      });

      // Create unmute case with resolved user tag
      const lastCase = await container.prisma.modCase.findFirst({
        where: { guildId },
        orderBy: { caseNumber: 'desc' },
      });

      const action =
        type === MuteType.TEXT
          ? 'UNMUTE_TEXT'
          : type === MuteType.VOICE
            ? 'UNMUTE_VOICE'
            : 'UNMUTE_BOTH';

      const modAction =
        type === MuteType.TEXT
          ? ModAction.UNMUTE_TEXT
          : type === MuteType.VOICE
            ? ModAction.UNMUTE_VOICE
            : ModAction.UNMUTE_BOTH;

      // Get a proper user tag (not "Unknown#0000")
      const userTag = member?.user.tag ?? (await getSafeUserTag(userId));
      const newCaseNumber = (lastCase?.caseNumber ?? 0) + 1;

      await container.prisma.modCase.create({
        data: {
          caseNumber: newCaseNumber,
          guildId,
          action,
          targetId: userId,
          targetTag: userTag,
          moderatorId: container.client.user?.id ?? 'System',
          moderatorTag: container.client.user?.tag ?? 'System',
          reason: `Automatic unmute - Mute expired`,
        },
      });

      // Log to mod channel
      await logModAction(
        guild,
        modAction,
        { id: userId, tag: userTag },
        'System',
        'Automatic unmute - Mute expired',
        newCaseNumber as CaseNumber,
        undefined,
        { automatic: true }
      );

      container.logger.info(
        `[MuteScheduler] Successfully unmuted user ${userId} (${type}) in guild ${guildId}`
      );
    } catch (error) {
      container.logger.error(`[MuteScheduler] Failed to unmute user ${userId}:`, error);
      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Get pending unmutes count
   */
  async getPendingCount(): Promise<number> {
    if (!this.queue) return 0;
    return this.queue.getDelayedCount();
  }

  /**
   * Check if voice unmute should be suppressed due to active mute-all in the channel
   */
  private async shouldSuppressVoiceUnmute(guildId: GuildId, member: GuildMember): Promise<boolean> {
    const channelId = member.voice.channelId;
    if (!channelId) return false;

    const stateKey = CacheKey.voiceMuteAllState(guildId, channelId);
    const muteAllState = await getJson(stateKey, VoiceMuteAllStateSchema);

    if (!muteAllState?.enabled) return false;
    if (Date.now() >= muteAllState.expiresAt) return false;

    return true;
  }

  /**
   * Ensure the member is tracked for unmute when mute-all ends or they change channel
   */
  private async deferVoiceUnmuteForMuteAll(guildId: GuildId, member: GuildMember): Promise<void> {
    const channelId = member.voice.channelId;
    if (!channelId) return;

    const ignoreKey = CacheKey.voiceMuteAllIgnore(guildId, channelId);
    const affectedKey = CacheKey.voiceMuteAllAffected(guildId, channelId);

    await container.redis.sadd(affectedKey, member.id);
    await container.redis.srem(ignoreKey, member.id);

    // Refresh TTLs to keep sets alive for the duration
    await container.redis.expire(affectedKey, VOICE_CACHE_TTL.muteAllState);
    await container.redis.expire(ignoreKey, VOICE_CACHE_TTL.muteAllState);
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
    container.logger.info('[MuteScheduler] Shutdown complete');
  }
}

// Export singleton instance
export const muteScheduler = new MuteScheduler();
