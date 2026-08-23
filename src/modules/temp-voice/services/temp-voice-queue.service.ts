/**
 * Temp Voice Queue Service
 * Manages BullMQ jobs for channel creation and deletion to prevent race conditions and rate limiting.
 * BullMQ is the SINGLE authority for deletion scheduling — no in-memory timers.
 */

import { Queue, Worker, type Job } from 'bullmq';
import { container } from '@sapphire/framework';
import { CONFIG } from '../../../config.js';
import {
  Colors,
  WebhookClient,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { EMOJI } from '#lib/discord/design/index.js';
import { encodeCustomId } from '#lib/discord/core/index.js';
import { TempVoiceConfigService } from './config.service.js';
import { TempChannelService } from './temp-channel.service.js';
import { ControlPanelService } from './control-panel.service.js';
import { PermissionsService } from './permissions.service.js';
import { UserPreferencesService } from './user-preferences.service.js';

interface CreateChannelJobData {
  type: 'create';
  guildId: string;
  userId: string;
  sourceChannelId: string;
  timestamp: number;
}

interface DeleteChannelJobData {
  type: 'delete';
  guildId: string;
  channelId: string;
  reason: string;
  timestamp: number;
}

interface NotifyClaimableJobData {
  type: 'notify_claimable';
  guildId: string;
  channelId: string;
  ownerId: string;
  timestamp: number;
}

type TempVoiceJobData = CreateChannelJobData | DeleteChannelJobData | NotifyClaimableJobData;

class TempVoiceQueueService {
  private queue: Queue<TempVoiceJobData>;
  private worker: Worker<TempVoiceJobData>;
  private readonly QUEUE_NAME = 'temp-voice-operations';

  // Shared service instances — avoid re-instantiating per job
  private configService!: TempVoiceConfigService;
  private permissionsService!: PermissionsService;
  private channelService!: TempChannelService;
  private controlPanelService!: ControlPanelService;
  private userPrefsService!: UserPreferencesService;

  constructor() {
    const connection = {
      host: CONFIG.REDIS_HOST,
      port: CONFIG.REDIS_PORT,
      password: CONFIG.REDIS_PASSWORD,
      db: CONFIG.REDIS_DB,
    };

    // Create queue for adding jobs
    this.queue = new Queue<TempVoiceJobData>(this.QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s, then 4s, then 8s
        },
        removeOnComplete: {
          age: 1800, // Keep completed jobs for 30 minutes
          count: 500,
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    });

    // Create worker to process jobs
    this.worker = new Worker<TempVoiceJobData>(
      this.QUEUE_NAME,
      async (job: Job<TempVoiceJobData>) => this.processJob(job),
      {
        connection,
        concurrency: 1, // Process one operation at a time per guild to avoid race conditions
        limiter: {
          max: 10, // Max 10 operations
          duration: 10000, // Per 10 seconds (Discord rate limit friendly)
        },
      }
    );

    // Worker event handlers
    this.worker.on('completed', (job) => {
      container.logger.debug(
        `[TempVoice Queue] Job ${job.id} (${job.data.type}) completed for guild ${job.data.guildId}`
      );
    });

    this.worker.on('failed', (job, err) => {
      container.logger.error(`[TempVoice Queue] Job ${job?.id} (${job?.data?.type}) failed:`, err);
    });

    this.worker.on('error', (err) => {
      container.logger.error('[TempVoice Queue] Worker error:', err);
    });

    this.worker.on('active', (job) => {
      container.logger.info(
        `[TempVoice Queue] Job ${job.id} (${job.data.type}) is now active for guild ${job.data.guildId}`
      );
    });

    container.logger.info('[TempVoice Queue] Service initialized');
  }

  /**
   * Lazily initialize shared services (container.prisma/client may not be ready at constructor time)
   */
  private ensureServices(): void {
    if (!this.configService) {
      this.configService = new TempVoiceConfigService(container.prisma, container.client);
      this.permissionsService = new PermissionsService();
      this.channelService = new TempChannelService(container.prisma, this.permissionsService);
      this.controlPanelService = new ControlPanelService(container.client, this.channelService);
      this.userPrefsService = new UserPreferencesService(container.prisma);
    }
  }

  /**
   * Process a temp voice job
   */
  private async processJob(job: Job<TempVoiceJobData>): Promise<void> {
    const { data } = job;

    if (data.type === 'create') {
      await this.processCreate(data);
    } else if (data.type === 'delete') {
      await this.processDelete(data);
    } else if (data.type === 'notify_claimable') {
      await this.processNotifyClaimable(data);
    }
  }

  /**
   * Process channel creation
   */
  private async processCreate(data: CreateChannelJobData): Promise<void> {
    const { guildId, userId, sourceChannelId } = data;
    this.ensureServices();

    try {
      const guild = container.client.guilds.cache.get(guildId);
      if (!guild) {
        container.logger.warn(`[TempVoice Queue] Guild ${guildId} not found`);
        return;
      }

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        container.logger.warn(`[TempVoice Queue] Member ${userId} not found in guild ${guildId}`);
        return;
      }

      // Get config
      const config = await this.configService.getOrNull(guildId);
      if (!config || !config.enabled) {
        container.logger.warn(
          `[TempVoice Queue] Config not found or disabled for guild ${guildId}`
        );
        return;
      }

      // If user already disconnected from voice, skip channel creation entirely
      if (!member.voice?.channelId) {
        container.logger.info(
          `[TempVoice Queue] User ${userId} is no longer in voice, skipping create`
        );
        return;
      }

      // Double-check: if user already owns a channel, redirect instead of creating
      const existingChannels = await this.channelService.getByOwnerId(guildId, userId);
      for (const existing of existingChannels) {
        const existingDiscord = await guild.channels.fetch(existing.channelId).catch(() => null);
        if (existingDiscord?.isVoiceBased()) {
          // Cancel pending deletion and redirect
          await this.cancelDelete(guildId, existing.channelId);
          try {
            await member.voice.setChannel(existingDiscord);
            container.logger.info(
              `[TempVoice Queue] Redirected user ${userId} to existing channel ${existing.channelId} (queue double-check)`
            );
          } catch {
            // Failed to move
          }
          return;
        }
      }

      // Double-check maxChannelsPerUser as second line of defense
      if (config.maxChannelsPerUser > 0) {
        const userChannelCount = await this.channelService.countUserChannels(guildId, userId);
        if (userChannelCount >= config.maxChannelsPerUser) {
          container.logger.info(
            `[TempVoice Queue] User ${userId} already has ${userChannelCount}/${config.maxChannelsPerUser} channels, skipping create`
          );
          return;
        }
      }

      // Create the channel
      const channel = await this.channelService.createChannel(
        guild,
        member,
        config,
        sourceChannelId
      );

      // Move user to the new channel (only if still in voice)
      try {
        const voiceState = member.voice;
        if (voiceState?.channelId) {
          await voiceState.setChannel(channel);
        }
      } catch (error) {
        container.logger.error(
          `[TempVoice Queue] Failed to move user ${userId} to channel ${channel.id}:`,
          error
        );
      }

      // Send control panel if enabled
      if (config.controlPanelOnCreate && config.controlPanelEnabled) {
        await this.controlPanelService.send(channel.id, member);
      }

      // Log to configured log channel if enabled
      if (config.logWebhook) {
        try {
          const webhook = new WebhookClient({ url: config.logWebhook });
          const embed = new EmbedBuilder()
            .setTitle('🎙️ Temporary Voice Channel Created')
            .setDescription(`${member} created a temporary voice channel`)
            .addFields(
              { name: 'Channel', value: `${channel.name} (<#${channel.id}>)`, inline: true },
              { name: 'Owner', value: `${member.user.tag} (${member.id})`, inline: true }
            )
            .setColor(Colors.Green)
            .setTimestamp();

          await webhook.send({ embeds: [embed] });
          webhook.destroy();
        } catch (error) {
          container.logger.error('[TempVoice Queue] Failed to send creation log:', error);
        }
      }

      container.logger.info(
        `[TempVoice Queue] Created temp channel ${channel.id} for user ${userId} in guild ${guildId}`
      );
    } catch (error) {
      container.logger.error(
        `[TempVoice Queue] Error creating temp channel for user ${userId}:`,
        error
      );
      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Process channel deletion.
   * Re-checks member count before deleting — if someone rejoined, skip.
   */
  private async processDelete(data: DeleteChannelJobData): Promise<void> {
    const { guildId, channelId, reason } = data;
    this.ensureServices();

    container.logger.info(
      `[TempVoice Queue] Processing delete job for channel ${channelId} in guild ${guildId}`
    );

    try {
      const guild = container.client.guilds.cache.get(guildId);
      if (!guild) {
        container.logger.warn(`[TempVoice Queue] Guild ${guildId} not found for deletion`);
        return;
      }

      // Re-fetch Discord channel and check if still empty
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (channel && channel.isVoiceBased() && channel.members.size > 0) {
        // Channel is occupied — cancel deletion
        container.logger.info(
          `[TempVoice Queue] Channel ${channelId} now has ${channel.members.size} members, skipping delete`
        );
        // Clear deletionScheduledAt since we're not deleting
        await this.channelService.update(channelId, { deletionScheduledAt: null }).catch(() => {});
        return;
      }

      // Get config for logging
      const config = await this.configService.getOrNull(guildId);

      // Get channel data before deletion to save preferences
      const tempChannel = await this.channelService.getByChannelId(channelId);

      // Save user preferences before deleting (if customization is allowed)
      if (tempChannel && config?.allowCustomization) {
        await this.userPrefsService.saveFromChannel(guildId, tempChannel.ownerId, {
          customName: tempChannel.customName,
          customUserLimit: tempChannel.customUserLimit,
          customBitrate: tempChannel.customBitrate,
          customRegion: tempChannel.customRegion,
          isLocked: tempChannel.isLocked,
          isHidden: tempChannel.isHidden,
          allowedUserIds: (tempChannel.allowedUserIds as string[]) || [],
          deniedUserIds: (tempChannel.deniedUserIds as string[]) || [],
          trustedUserIds: (tempChannel.trustedUserIds as string[]) || [],
        });
        container.logger.info(
          `[TempVoice Queue] Saved user preferences for ${tempChannel.ownerId} before deletion`
        );
      }

      // Delete from Discord
      if (channel) {
        await channel.delete(reason);
      }

      // Delete from database
      await this.channelService.delete(channelId);

      // Log deletion if enabled
      if (config?.logWebhook) {
        try {
          const webhook = new WebhookClient({ url: config.logWebhook });
          const embed = new EmbedBuilder()
            .setTitle('🎙️ Temporary Voice Channel Deleted')
            .setDescription(`Temporary voice channel was deleted`)
            .addFields(
              { name: 'Channel ID', value: channelId, inline: true },
              { name: 'Reason', value: reason, inline: true }
            )
            .setColor(Colors.Red)
            .setTimestamp();

          await webhook.send({ embeds: [embed] });
          webhook.destroy();
        } catch (error) {
          container.logger.error('[TempVoice Queue] Failed to send deletion log:', error);
        }
      }

      container.logger.info(`[TempVoice Queue] Deleted temp channel ${channelId} - ${reason}`);
    } catch (error) {
      container.logger.error(`[TempVoice Queue] Error deleting channel ${channelId}:`, error);
      // Don't re-throw - channel might already be deleted
    }
  }

  /**
   * Queue a channel creation job
   */
  async queueCreate(guildId: string, userId: string, sourceChannelId: string): Promise<void> {
    await this.queue.add(
      'create-channel',
      {
        type: 'create',
        guildId,
        userId,
        sourceChannelId,
        timestamp: Date.now(),
      },
      {
        jobId: `create-${guildId}-${userId}-${Date.now()}`, // Unique job ID
        priority: 1, // High priority for creates
      }
    );

    container.logger.debug(
      `[TempVoice Queue] Queued create for user ${userId} in guild ${guildId}`
    );
  }

  /**
   * Queue a channel deletion job and mark deletionScheduledAt in Prisma.
   */
  async queueDelete(
    guildId: string,
    channelId: string,
    reason: string,
    delayMs: number = 0
  ): Promise<void> {
    this.ensureServices();
    const jobId = `delete-${guildId}-${channelId}`;

    // Remove any existing delete job for this channel (prevents duplicates)
    const existingJob = await this.queue.getJob(jobId);
    if (existingJob) {
      await existingJob.remove().catch(() => {});
    }

    await this.queue.add(
      'delete-channel',
      {
        type: 'delete',
        guildId,
        channelId,
        reason,
        timestamp: Date.now(),
      },
      {
        jobId, // Unique job ID
        priority: 2, // Lower priority than creates
        delay: delayMs, // Optional delay before deletion
      }
    );

    // Mark in Prisma so other code paths can see a deletion is pending
    await this.channelService
      .update(channelId, { deletionScheduledAt: new Date(Date.now() + delayMs) })
      .catch(() => {
        // Channel may not exist in DB yet (race condition) — harmless
      });

    container.logger.info(
      `[TempVoice Queue] Queued delete for channel ${channelId} in guild ${guildId} (delay: ${delayMs}ms, jobId: ${jobId}, will execute at: ${new Date(Date.now() + delayMs).toISOString()})`
    );
  }

  /**
   * Cancel a pending deletion job and clear deletionScheduledAt in Prisma.
   * No-op if no job exists.
   */
  async cancelDelete(guildId: string, channelId: string): Promise<boolean> {
    this.ensureServices();
    const jobId = `delete-${guildId}-${channelId}`;
    const job = await this.queue.getJob(jobId);

    let cancelled = false;
    if (job) {
      await job.remove().catch(() => {});
      cancelled = true;
      container.logger.debug(`[TempVoice Queue] Cancelled delete for channel ${channelId}`);
    }

    // Always clear deletionScheduledAt (defensive)
    await this.channelService.update(channelId, { deletionScheduledAt: null }).catch(() => {});

    return cancelled;
  }

  /**
   * Queue a delayed notification telling remaining members the channel is claimable.
   */
  async queueNotifyClaimable(
    guildId: string,
    channelId: string,
    ownerId: string,
    delayMs: number
  ): Promise<void> {
    const jobId = `notify-claimable-${guildId}-${channelId}`;

    // Remove any existing notification job for this channel
    const existingJob = await this.queue.getJob(jobId);
    if (existingJob) {
      await existingJob.remove().catch(() => {});
    }

    await this.queue.add(
      'notify-claimable',
      {
        type: 'notify_claimable',
        guildId,
        channelId,
        ownerId,
        timestamp: Date.now(),
      },
      {
        jobId,
        priority: 3,
        delay: delayMs,
      }
    );

    container.logger.info(
      `[TempVoice Queue] Queued claimable notification for channel ${channelId} (delay: ${delayMs}ms)`
    );
  }

  /**
   * Cancel a pending claimable notification (e.g. owner rejoined).
   */
  async cancelNotifyClaimable(guildId: string, channelId: string): Promise<boolean> {
    const jobId = `notify-claimable-${guildId}-${channelId}`;
    const job = await this.queue.getJob(jobId);

    if (job) {
      await job.remove().catch(() => {});
      container.logger.debug(
        `[TempVoice Queue] Cancelled claimable notification for channel ${channelId}`
      );
      return true;
    }
    return false;
  }

  /**
   * Process a claimable notification — send a message with a Claim button if owner is still absent.
   */
  private async processNotifyClaimable(data: NotifyClaimableJobData): Promise<void> {
    const { guildId, channelId, ownerId } = data;
    this.ensureServices();

    try {
      const guild = container.client.guilds.cache.get(guildId);
      if (!guild) return;

      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isVoiceBased()) return;

      // If channel is empty or owner came back, skip
      if (channel.members.size === 0) return;
      if (channel.members.has(ownerId)) {
        container.logger.info(
          `[TempVoice Queue] Owner ${ownerId} is back in ${channelId}, skipping claimable notification`
        );
        return;
      }

      // Send a message with a Claim button
      const claimButton = new ButtonBuilder()
        .setCustomId(encodeCustomId('tv', 'claim', channelId))
        .setLabel('Claim Channel')
        .setEmoji(EMOJI.USER.ROLES.OWNER)
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(claimButton);

      await channel.send({
        content: `${EMOJI.STATUS.WARNING} The channel owner has left. Any member in the channel can claim ownership.`,
        components: [row],
      });

      container.logger.info(
        `[TempVoice Queue] Sent claimable notification for channel ${channelId} (owner ${ownerId} absent)`
      );
    } catch (error) {
      container.logger.error(`[TempVoice Queue] Error sending claimable notification:`, error);
    }
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    container.logger.info('[TempVoice Queue] Service shut down');
  }
}

// Export singleton instance
export const tempVoiceQueue = new TempVoiceQueueService();
