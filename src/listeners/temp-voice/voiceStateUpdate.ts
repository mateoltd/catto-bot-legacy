/**
 * Listener for voice state updates to handle temp voice channel creation and cleanup
 */

import { Listener } from '@sapphire/framework';
import type { VoiceState } from 'discord.js';
import { Events, Colors, WebhookClient, EmbedBuilder } from 'discord.js';
import { container } from '@sapphire/framework';
import { TempVoiceConfigService } from '../../modules/temp-voice/services/config.service.js';
import { TempChannelService } from '../../modules/temp-voice/services/temp-channel.service.js';
import { PermissionsService } from '../../modules/temp-voice/services/permissions.service.js';
import { tempVoiceQueue } from '../../modules/temp-voice/services/temp-voice-queue.service.js';
import {
  REDIS_KEYS,
  OwnerLeaveStrategy,
  OWNER_LEAVE_BUFFER_MS,
} from '../../modules/temp-voice/constants.js';

export class TempVoiceStateUpdateListener extends Listener {
  private configService!: TempVoiceConfigService;
  private channelService!: TempChannelService;
  private permissionsService!: PermissionsService;

  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.VoiceStateUpdate,
      name: 'tempVoiceStateUpdateListener',
    });
  }

  public async run(oldState: VoiceState, newState: VoiceState): Promise<void> {
    // Initialize services (lazy initialization)
    if (!this.configService) {
      this.configService = new TempVoiceConfigService(container.prisma, container.client);
      this.permissionsService = new PermissionsService();
      this.channelService = new TempChannelService(container.prisma, this.permissionsService);
    }

    // Handle different voice state changes
    const joinedChannel = !oldState.channelId && newState.channelId;
    const leftChannel = oldState.channelId && !newState.channelId;
    const movedChannel =
      oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

    try {
      if (joinedChannel) {
        await this.handleJoin(newState);
      }

      if (leftChannel) {
        await this.handleLeave(oldState);
      }

      if (movedChannel) {
        // Handle as leave from old, join to new
        await this.handleLeave(oldState);
        await this.handleJoin(newState);
      }
    } catch (error) {
      this.container.logger.error(`[TempVoice] Error handling voice state update:`, error);
    }
  }

  /**
   * Handle user joining a voice channel
   */
  private async handleJoin(state: VoiceState): Promise<void> {
    if (!state.guild || !state.member || !state.channelId) return;

    // Get config
    const config = await this.configService.getOrNull(state.guild.id);
    if (!config || !config.enabled) {
      this.container.logger.debug(`[TempVoice] No config or disabled for guild ${state.guild.id}`);
      return;
    }

    this.container.logger.debug(
      `[TempVoice] User ${state.member.id} joined channel ${state.channelId}`
    );
    this.container.logger.debug(
      `[TempVoice] JTC channels: ${JSON.stringify(config.joinToCreateChannels)}`
    );

    // Check if this is a Join to Create channel
    const isJTC = config.joinToCreateChannels.includes(state.channelId);

    this.container.logger.debug(`[TempVoice] Is JTC channel: ${isJTC}`);

    if (isJTC) {
      const guildId = state.guild.id;
      const userId = state.member.id;

      // ── Channel reuse: redirect to existing owned channel instead of creating ──
      const existingChannels = await this.channelService.getByOwnerId(guildId, userId);
      for (const existing of existingChannels) {
        const discordChannel = await state.guild.channels
          .fetch(existing.channelId)
          .catch(() => null);
        if (discordChannel?.isVoiceBased()) {
          // Found an existing channel the user still owns — redirect them
          await tempVoiceQueue.cancelDelete(guildId, existing.channelId);
          try {
            await state.member.voice.setChannel(discordChannel);
            this.container.logger.info(
              `[TempVoice] Redirected user ${userId} to existing channel ${existing.channelId}`
            );
          } catch {
            // Failed to move — user may have disconnected
          }
          return;
        } else {
          // Channel no longer exists on Discord — clean up orphaned DB record
          await this.channelService.delete(existing.channelId);
        }
      }

      // ── Cooldown check ──
      if (config.cooldownSeconds > 0) {
        try {
          const cooldownKey = `${REDIS_KEYS.COOLDOWN}:${userId}:${guildId}`;
          const existing = await container.redis.get(cooldownKey);
          if (existing) {
            this.container.logger.debug(
              `[TempVoice] User ${userId} on cooldown, disconnecting from JTC`
            );
            await state.member.voice.disconnect().catch(() => {});
            return;
          }
        } catch {
          // Redis unavailable — skip cooldown check (fail open)
        }
      }

      // ── Max channels per user check ──
      if (config.maxChannelsPerUser > 0) {
        const userChannelCount = await this.channelService.countUserChannels(guildId, userId);
        if (userChannelCount >= config.maxChannelsPerUser) {
          this.container.logger.debug(
            `[TempVoice] User ${userId} already has ${userChannelCount}/${config.maxChannelsPerUser} channels, disconnecting from JTC`
          );
          await state.member.voice.disconnect().catch(() => {});
          return;
        }
      }

      // Queue channel creation
      await tempVoiceQueue.queueCreate(guildId, userId, state.channelId);

      // Set cooldown after successful queue
      if (config.cooldownSeconds > 0) {
        try {
          const cooldownKey = `${REDIS_KEYS.COOLDOWN}:${userId}:${guildId}`;
          await container.redis.setex(cooldownKey, config.cooldownSeconds, '1');
        } catch {
          // Redis unavailable — cooldown not set (non-critical)
        }
      }

      this.container.logger.info(
        `[TempVoice] Queued temp channel creation for user ${userId} in guild ${guildId}`
      );
    } else {
      // Always attempt to cancel any pending deletion for this temp channel (no-op if none exists)
      const tempChannel = await this.channelService.getByChannelId(state.channelId);
      if (tempChannel) {
        const cancelled = await tempVoiceQueue.cancelDelete(state.guild.id, state.channelId);
        if (cancelled) {
          this.container.logger.info(
            `[TempVoice] Cancelled deletion for ${state.channelId} - user rejoined`
          );
        }

        // If the owner rejoined, cancel any pending claimable notification
        if (state.member && state.member.id === tempChannel.ownerId) {
          await tempVoiceQueue.cancelNotifyClaimable(state.guild.id, state.channelId);
        }
      }
    }
  }

  /**
   * Handle user leaving a voice channel
   */
  private async handleLeave(state: VoiceState): Promise<void> {
    if (!state.guild || !state.channelId) return;

    // Check if the channel they left is a temp channel
    const tempChannel = await this.channelService.getByChannelId(state.channelId);
    if (!tempChannel) return;

    // Fetch the actual Discord channel to check if it's empty
    const discordChannel = await state.guild.channels.fetch(state.channelId).catch(() => null);

    if (!discordChannel || !discordChannel.isVoiceBased()) {
      // Channel doesn't exist anymore - clean up database
      await this.channelService.delete(state.channelId);
      return;
    }

    // Check if channel is now empty
    if (discordChannel.members.size === 0) {
      // Get config for deletion delay
      const config = await this.configService.getOrNull(state.guild.id);
      const delayMs = config ? config.deleteDelaySeconds * 1000 : 5000; // Default 5 seconds

      // Queue deletion with delay
      await tempVoiceQueue.queueDelete(state.guild.id, state.channelId, 'Channel empty', delayMs);

      this.container.logger.info(
        `[TempVoice] Queued deletion for empty channel ${state.channelId} (delay: ${delayMs}ms)`
      );

      // Log to configured log channel if enabled
      if (config?.logWebhook) {
        try {
          const webhook = new WebhookClient({ url: config.logWebhook });
          const embed = new EmbedBuilder()
            .setTitle('🎙️ Temporary Voice Channel Empty')
            .setDescription(`Temporary voice channel is now empty and scheduled for deletion`)
            .addFields(
              {
                name: 'Channel',
                value: `${discordChannel.name} (<#${state.channelId}>)`,
                inline: true,
              },
              { name: 'Deletion in', value: `${config.deleteDelaySeconds} seconds`, inline: true }
            )
            .setColor(Colors.Yellow)
            .setTimestamp();

          await webhook.send({ embeds: [embed] });
          webhook.destroy();
        } catch (error) {
          this.container.logger.error('[TempVoice] Failed to send empty log:', error);
        }
      }
    } else {
      // Channel still has members
      await this.channelService.updateLastActive(state.channelId);

      // Apply owner leave strategy if the leaving user is the channel owner
      if (state.member && state.member.id === tempChannel.ownerId) {
        const config = await this.configService.getOrNull(state.guild.id);
        const strategy = config?.ownerLeaveStrategy ?? OwnerLeaveStrategy.TRANSFER;

        switch (strategy) {
          case OwnerLeaveStrategy.TRANSFER: {
            // Transfer to the longest-present member (first in the members collection)
            const remainingMembers = discordChannel.members.filter(
              (m) => m.id !== tempChannel.ownerId
            );
            const newOwner = remainingMembers.first();
            if (newOwner) {
              // Rebuild permissions atomically with new owner
              await discordChannel.permissionOverwrites.set(
                this.permissionsService.buildOverwrites({
                  ownerId: newOwner.id,
                  guildId: state.guild.id,
                  isLocked: tempChannel.isLocked,
                  isHidden: tempChannel.isHidden,
                  allowedUserIds: (tempChannel.allowedUserIds as string[]) || [],
                  deniedUserIds: (tempChannel.deniedUserIds as string[]) || [],
                  trustedUserIds: (tempChannel.trustedUserIds as string[]) || [],
                })
              );
              await this.channelService.update(state.channelId, { ownerId: newOwner.id });
              this.container.logger.info(
                `[TempVoice] Auto-transferred ownership of ${state.channelId} to ${newOwner.id}`
              );
            }
            break;
          }
          case OwnerLeaveStrategy.DELETE: {
            const delayMs = config ? config.deleteDelaySeconds * 1000 : 5000;
            await tempVoiceQueue.queueDelete(
              state.guild.id,
              state.channelId,
              'Owner left (DELETE strategy)',
              delayMs
            );
            this.container.logger.info(
              `[TempVoice] Owner left, scheduled deletion for ${state.channelId} (DELETE strategy)`
            );
            break;
          }
          case OwnerLeaveStrategy.KEEP:
          default:
            // Owner retains ownership; notify remaining members after a buffer
            await tempVoiceQueue.queueNotifyClaimable(
              state.guild.id,
              state.channelId,
              tempChannel.ownerId,
              OWNER_LEAVE_BUFFER_MS
            );
            this.container.logger.info(
              `[TempVoice] Owner left ${state.channelId}, queued claimable notification in ${OWNER_LEAVE_BUFFER_MS / 1000}s`
            );
            break;
        }
      }
    }
  }
}
