/**
 * Channel Update Listener for Name Moderation
 * Monitors temp voice channels for name changes and applies moderation
 */

import { Listener } from "@sapphire/framework";
import type {
  VoiceChannel,
  DMChannel,
  NonThreadGuildBasedChannel,
} from "discord.js";
import { Events, ChannelType, AuditLogEvent } from "discord.js";
import { container } from "@sapphire/framework";
import { TempChannelService } from "../../modules/temp-voice/services/temp-channel.service.js";
import { TempVoiceConfigService } from "../../modules/temp-voice/services/config.service.js";
import { NameModerationService } from "../../modules/temp-voice/services/moderation/name-moderation.service.js";
import { getTempVoiceTransport } from "../../modules/temp-voice/application/temp-voice-runtime.js";

export class ChannelUpdateListener extends Listener {
  private configService!: TempVoiceConfigService;
  private channelService!: TempChannelService;
  private moderationService!: NameModerationService;

  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: Events.ChannelUpdate,
    });
  }

  public async run(
    oldChannel: DMChannel | NonThreadGuildBasedChannel,
    newChannel: DMChannel | NonThreadGuildBasedChannel,
  ): Promise<void> {
    // Initialize services (lazy initialization)
    if (!this.configService) {
      this.configService = new TempVoiceConfigService(
        container.prisma,
        container.client,
      );
      this.channelService = new TempChannelService(container.prisma);
      this.moderationService = new NameModerationService(
        container.prisma,
        container.logger,
      );
    }

    try {
      // Only process voice channels
      if (newChannel.type !== ChannelType.GuildVoice) {
        return;
      }

      // Only process guild channels
      if (newChannel.isDMBased()) {
        return;
      }

      const voiceChannel = newChannel as VoiceChannel;
      const oldVoiceChannel = oldChannel as VoiceChannel;

      // Resolve management before filtering by update type. Permission and setting changes also
      // need to pass through the central projection path.
      const tempChannel = await this.channelService.getByChannelId(
        voiceChannel.id,
      );
      if (!tempChannel) return;

      // Check if name changed
      if (oldVoiceChannel.name === voiceChannel.name) {
        await getTempVoiceTransport().publish({
          kind: "CHANNEL_UPDATED",
          guildId: voiceChannel.guild.id,
          channelId: voiceChannel.id,
          observedAt: Date.now(),
        });
        return;
      }

      this.container.logger.debug(
        `[Name Moderation] Channel name changed: ${oldVoiceChannel.name} -> ${voiceChannel.name} (Channel ID: ${voiceChannel.id})`,
      );

      this.container.logger.debug(
        `[Name Moderation] Channel ${voiceChannel.id} is a temp voice channel owned by ${tempChannel.ownerId}`,
      );

      // Get guild configuration
      const config = await this.configService.getOrNull(voiceChannel.guild.id);
      if (!config) {
        await this.publishObservedName(voiceChannel, voiceChannel.name);
        return;
      }

      // Check if moderation is enabled
      if (!config.moderationEnabled) {
        this.container.logger.debug(
          `[Name Moderation] Moderation disabled for guild ${voiceChannel.guild.id}`,
        );
        await this.publishObservedName(voiceChannel, voiceChannel.name);
        return;
      }

      this.container.logger.debug(
        `[Name Moderation] Moderation enabled for guild ${voiceChannel.guild.id}, action: ${config.moderationAction}`,
      );

      // Get the user who made the change from audit logs
      let userId = tempChannel.ownerId; // Default fallback

      try {
        // Fetch recent audit logs for channel updates
        const auditLogs = await voiceChannel.guild.fetchAuditLogs({
          type: AuditLogEvent.ChannelUpdate,
          limit: 5,
        });

        // Find the most recent entry for this channel (within last 5 seconds)
        const now = Date.now();
        const recentEntry = auditLogs.entries.find((entry) => {
          const isThisChannel = entry.target?.id === voiceChannel.id;
          const isRecent = now - entry.createdTimestamp < 5000; // 5 seconds
          return isThisChannel && isRecent;
        });

        if (recentEntry?.executor) {
          userId = recentEntry.executor.id;
        }
      } catch (error) {
        // Audit log fetch failed (likely missing permissions) - use owner fallback
        this.container.logger.debug(
          `[Name Moderation] Could not fetch audit logs for guild ${voiceChannel.guild.id}, using owner as fallback ${error}`,
        );
      }

      // Moderate the name change
      const result = await this.moderationService.moderateChannelName(
        voiceChannel,
        oldVoiceChannel.name,
        voiceChannel.name,
        config,
        userId,
      );

      if (result && !result.validation.isAllowed) {
        this.container.logger.info(
          `[Name Moderation] Channel ${voiceChannel.id} moderated: ${oldVoiceChannel.name} -> ${result.finalName}`,
          {
            guildId: voiceChannel.guild.id,
            channelId: voiceChannel.id,
            action: result.actionTaken,
            reasonCodes: result.validation.reasonCodes,
          },
        );
      }
      await this.publishObservedName(
        voiceChannel,
        result?.finalName ?? voiceChannel.name,
      );
    } catch (error) {
      this.container.logger.error(
        `[Name Moderation] Error handling channel update for ${newChannel.id}:`,
        error,
      );
    }
  }

  private publishObservedName(
    channel: VoiceChannel,
    observedName: string,
  ): Promise<void> {
    return getTempVoiceTransport().publish({
      kind: "CHANNEL_UPDATED",
      guildId: channel.guild.id,
      channelId: channel.id,
      observedName,
      observedAt: Date.now(),
    });
  }
}
