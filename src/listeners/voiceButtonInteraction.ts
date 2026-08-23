import { Listener, container } from '@sapphire/framework';
import {
  Events,
  type Interaction,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  type ButtonInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { getJson, setJson, CacheKey } from '#lib/cache/index.js';
import {
  VoiceWatchSessionSchema,
  VoiceTrackSessionSchema,
  VoiceMuteAllStateSchema,
  VOICE_CACHE_TTL,
  MUTE_ALL_DURATION_MS,
  type VoiceMuteAllState,
} from '#root/modules/voice/domain/types.js';
import {
  cleanupWatchSession,
  cleanupTrackSession,
} from '#root/modules/voice/services/sessionManager.js';
import { forceRefreshWatch, forceRefreshTrack } from '#root/modules/voice/services/voiceUpdate.js';
import { logVoiceMuteAllAction } from '#root/modules/moderation/discord/embeds/presets.js';
import {
  voiceMuteAllScheduler,
  disableMuteAllForChannel,
} from '#root/modules/voice/services/VoiceMuteAllScheduler.js';
import { ensureNonNull } from '#lib/utils.js';

export class VoiceButtonInteractionListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.InteractionCreate,
    });
  }

  public async run(interaction: Interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.guildId) return;

    const customId = interaction.customId;
    const guildId = interaction.guildId;

    if (customId.startsWith('voice_watch_stop:')) {
      await this.handleWatchStop(interaction, guildId);
    } else if (customId.startsWith('voice_track_stop:')) {
      await this.handleTrackStop(interaction, guildId);
    } else if (customId.startsWith('voice_refresh_watch:')) {
      await this.handleRefreshWatch(interaction, guildId);
    } else if (customId.startsWith('voice_refresh_track:')) {
      await this.handleRefreshTrack(interaction, guildId);
    } else if (customId.startsWith('voice_copy_id:')) {
      await this.handleCopyId(interaction);
    } else if (customId.startsWith('voice_join:')) {
      await this.handleJoin(interaction);
    } else if (customId.startsWith('voice_mute:')) {
      await this.handleMute(interaction);
    } else if (customId.startsWith('voice_disconnect:')) {
      await this.handleDisconnect(interaction);
    } else if (customId.startsWith('voice_mute_all:')) {
      await this.handleMuteAll(interaction);
    }
  }

  private async handleWatchStop(interaction: ButtonInteraction, guildId: string): Promise<void> {
    const parts = interaction.customId.split(':');
    if (parts.length !== 2) return;
    const targetId = parts[1];
    if (!targetId) return;

    try {
      const watchKey = CacheKey.voiceWatchByTarget(guildId, targetId);
      const interactionIds = await container.redis.smembers(watchKey);

      let found = false;
      for (const interactionId of interactionIds) {
        const sessionKey = CacheKey.voiceWatch(guildId, interactionId);
        const session = await getJson(sessionKey, VoiceWatchSessionSchema);

        if (session && interaction.message && session.messageId === interaction.message.id) {
          await cleanupWatchSession(guildId, interactionId, session);
          found = true;
          break;
        }
      }

      if (found) {
        const containerComp = new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent('## Watch Stopped'),
          new TextDisplayBuilder().setContent('Stopped by moderator.')
        );

        await interaction.update({
          components: [containerComp],
          flags: MessageFlags.IsComponentsV2,
        });
      } else {
        await interaction.reply({
          content: 'This watch session has already ended or was not found.',
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      container.logger.error('[VoiceButtonInteraction] Error stopping watch:', error);
      await interaction
        .reply({
          content: 'An error occurred while stopping the watch.',
          flags: MessageFlags.Ephemeral,
        })
        .catch((err) => {
          container.logger.error('[VoiceButtonInteraction] Error replying to watch stop:', err);
        });
    }
  }

  private async handleTrackStop(interaction: ButtonInteraction, guildId: string): Promise<void> {
    const parts = interaction.customId.split(':');
    if (parts.length !== 2) return;
    const channelId = parts[1];
    if (!channelId) return;

    try {
      const trackKey = CacheKey.voiceTrackByChannel(guildId, channelId);
      const interactionIds = await container.redis.smembers(trackKey);

      let found = false;
      for (const interactionId of interactionIds) {
        const sessionKey = CacheKey.voiceTrack(guildId, interactionId);
        const session = await getJson(sessionKey, VoiceTrackSessionSchema);

        if (session && interaction.message && session.messageId === interaction.message.id) {
          await cleanupTrackSession(guildId, interactionId, session);
          found = true;
          break;
        }
      }

      if (found) {
        const containerComp = new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent('## Track Stopped'),
          new TextDisplayBuilder().setContent('Stopped by moderator.')
        );

        await interaction.update({
          components: [containerComp],
          flags: MessageFlags.IsComponentsV2,
        });
      } else {
        await interaction.reply({
          content: 'This track session has already ended or was not found.',
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      container.logger.error('[VoiceButtonInteraction] Error stopping track:', error);
      await interaction
        .reply({
          content: 'An error occurred while stopping the track.',
          flags: MessageFlags.Ephemeral,
        })
        .catch((err) => {
          container.logger.error('[VoiceButtonInteraction] Error replying to track stop:', err);
        });
    }
  }

  private async handleRefreshWatch(interaction: ButtonInteraction, guildId: string): Promise<void> {
    const parts = interaction.customId.split(':');
    if (parts.length !== 2) return;
    const targetId = parts[1];
    if (!targetId) return;

    try {
      await interaction.deferUpdate();

      const watchKey = CacheKey.voiceWatchByTarget(guildId, targetId);
      const interactionIds = await container.redis.smembers(watchKey);

      for (const interactionId of interactionIds) {
        const sessionKey = CacheKey.voiceWatch(guildId, interactionId);
        const session = await getJson(sessionKey, VoiceWatchSessionSchema);

        if (session && interaction.message && session.messageId === interaction.message.id) {
          const success = await forceRefreshWatch(guildId, interactionId, session);
          if (!success) {
            await interaction.followUp({
              content: 'Failed to refresh. The session may have ended.',
              flags: MessageFlags.Ephemeral,
            });
          }
          return;
        }
      }

      await interaction.followUp({
        content: 'This watch session has already ended or was not found.',
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      container.logger.error('[VoiceButtonInteraction] Error refreshing watch:', error);
    }
  }

  private async handleRefreshTrack(interaction: ButtonInteraction, guildId: string): Promise<void> {
    const parts = interaction.customId.split(':');
    if (parts.length !== 2) return;
    const channelId = parts[1];
    if (!channelId) return;

    try {
      await interaction.deferUpdate();

      const trackKey = CacheKey.voiceTrackByChannel(guildId, channelId);
      const interactionIds = await container.redis.smembers(trackKey);

      for (const interactionId of interactionIds) {
        const sessionKey = CacheKey.voiceTrack(guildId, interactionId);
        const session = await getJson(sessionKey, VoiceTrackSessionSchema);

        if (session && interaction.message && session.messageId === interaction.message.id) {
          const success = await forceRefreshTrack(guildId, interactionId, session);
          if (!success) {
            await interaction.followUp({
              content: 'Failed to refresh. The session may have ended.',
              flags: MessageFlags.Ephemeral,
            });
          }
          return;
        }
      }

      await interaction.followUp({
        content: 'This track session has already ended or was not found.',
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      container.logger.error('[VoiceButtonInteraction] Error refreshing track:', error);
    }
  }

  private async handleCopyId(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    if (parts.length !== 2) return;
    const targetId = parts[1];
    if (!targetId) return;

    await interaction.reply({
      content: `\`${targetId}\``,
      flags: MessageFlags.Ephemeral,
    });
  }

  private async handleJoin(interaction: ButtonInteraction): Promise<void> {
    const channelId = interaction.customId.split(':')[1];
    if (!channelId || !interaction.guild) return;

    try {
      const channel = interaction.guild.channels.cache.get(channelId);
      if (!channel?.isVoiceBased()) {
        await interaction.reply({
          content: 'Voice channel not found.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const inviteUrl = `https://discord.com/channels/${interaction.guildId}/${channelId}`;
      await interaction.reply({
        content: `**Join channel:** ${channel.name}\n${inviteUrl}`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      container.logger.error('[VoiceButtonInteraction] Error joining:', error);
      await interaction
        .reply({
          content: 'An error occurred.',
          flags: MessageFlags.Ephemeral,
        })
        .catch((err) => {
          container.logger.error('[VoiceButtonInteraction] Error replying to join:', err);
        });
    }
  }

  private async handleMute(interaction: ButtonInteraction): Promise<void> {
    const targetId = interaction.customId.split(':')[1];
    if (!targetId || !interaction.guild) return;

    try {
      const member = interaction.guild.members.cache.get(interaction.user.id);
      if (!member?.permissions.has(PermissionFlagsBits.MuteMembers)) {
        await interaction.reply({
          content: 'You do not have permission to mute members.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const target = await interaction.guild.members.fetch(targetId).catch(() => null);
      if (!target) {
        await interaction.reply({
          content: 'Member not found.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (!target.voice.channelId) {
        await interaction.reply({
          content: 'Member is not in a voice channel.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const newMuteState = !target.voice.serverMute;
      await target.voice.setMute(newMuteState);

      await interaction.reply({
        content: `**${target.displayName}** has been ${newMuteState ? 'muted' : 'unmuted'}.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      container.logger.error('[VoiceButtonInteraction] Error muting:', error);
      await interaction
        .reply({
          content: 'An error occurred while muting the member.',
          flags: MessageFlags.Ephemeral,
        })
        .catch((err) => {
          container.logger.error('[VoiceButtonInteraction] Error replying to mute:', err);
        });
    }
  }

  private async handleDisconnect(interaction: ButtonInteraction): Promise<void> {
    const targetId = interaction.customId.split(':')[1];
    if (!targetId || !interaction.guild) return;

    try {
      const member = interaction.guild.members.cache.get(interaction.user.id);
      if (!member?.permissions.has(PermissionFlagsBits.MoveMembers)) {
        await interaction.reply({
          content: 'You do not have permission to disconnect members.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const target = await interaction.guild.members.fetch(targetId).catch(() => null);
      if (!target) {
        await interaction.reply({
          content: 'Member not found.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (!target.voice.channelId) {
        await interaction.reply({
          content: 'Member is not in a voice channel.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await target.voice.disconnect();

      await interaction.reply({
        content: `**${target.displayName}** has been disconnected from voice.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      container.logger.error('[VoiceButtonInteraction] Error disconnecting:', error);
      await interaction
        .reply({
          content: 'An error occurred while disconnecting the member.',
          flags: MessageFlags.Ephemeral,
        })
        .catch((err) => {
          container.logger.error('[VoiceButtonInteraction] Error replying to disconnect:', err);
        });
    }
  }

  private async handleMuteAll(interaction: ButtonInteraction): Promise<void> {
    const channelId = interaction.customId.split(':')[1];
    if (!channelId || !interaction.guild) return;

    const guildId = ensureNonNull(
      interaction.guildId,
      'VoiceButtonInteractionListener.handleMuteAll: interaction.guildId'
    );

    try {
      const member = interaction.guild.members.cache.get(interaction.user.id);
      if (!member?.permissions.has(PermissionFlagsBits.MuteMembers)) {
        await interaction.reply({
          content: 'You do not have permission to mute members.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const channel = interaction.guild.channels.cache.get(channelId);
      if (!channel?.isVoiceBased()) {
        await interaction.reply({
          content: 'Voice channel not found.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Check current mute-all state
      const stateKey = CacheKey.voiceMuteAllState(guildId, channelId);
      const currentState = await getJson(stateKey, VoiceMuteAllStateSchema);

      if (currentState?.enabled) {
        // Toggle OFF - unmute everyone except ignorelist/DB-muted users
        await this.disableMuteAll(interaction, guildId, channelId, channel.name);
      } else {
        // Toggle ON - mute everyone except initiator
        await this.enableMuteAll(interaction, guildId, channelId, channel.name);
      }
    } catch (error) {
      container.logger.error('[VoiceButtonInteraction] Error in mute all toggle:', error);
      await interaction
        .editReply({
          content: 'An error occurred while toggling mute all.',
        })
        .catch((err) => {
          container.logger.error('[VoiceButtonInteraction] Error editing reply to mute all:', err);
        });
    }
  }

  /**
   * Enable mute-all: snapshot already-muted users (ignorelist), mute everyone except initiator and voice mods
   */
  private async enableMuteAll(
    interaction: ButtonInteraction,
    guildId: string,
    channelId: string,
    channelName: string
  ): Promise<void> {
    const channel = ensureNonNull(
      interaction.guild,
      'VoiceButtonInteractionListener.enableMuteAll'
    ).channels.cache.get(channelId);
    if (!channel?.isVoiceBased()) return;

    const members = channel.members;
    const initiatorId = interaction.user.id;
    const now = Date.now();
    const expiresAt = now + MUTE_ALL_DURATION_MS;

    // Keys for this channel's mute-all state
    const stateKey = CacheKey.voiceMuteAllState(guildId, channelId);
    const ignoreKey = CacheKey.voiceMuteAllIgnore(guildId, channelId);
    const affectedKey = CacheKey.voiceMuteAllAffected(guildId, channelId);

    // Clear any existing state first
    await container.redis.del(ignoreKey);
    await container.redis.del(affectedKey);

    let mutedCount = 0;
    let ignoredCount = 0;
    let exemptCount = 0;

    // Build the ignorelist and mute others
    for (const [userId, target] of members) {
      // Skip the initiator
      if (userId === initiatorId) {
        exemptCount++;
        continue;
      }

      // Skip members with MuteMembers permission (they can mute back, so exempt them)
      if (target.permissions.has(PermissionFlagsBits.MuteMembers)) {
        exemptCount++;
        continue;
      }

      if (target.voice.serverMute) {
        // Already muted - add to ignorelist
        await container.redis.sadd(ignoreKey, userId);
        ignoredCount++;
      } else {
        // Not muted - mute them and add to affected
        try {
          await target.voice.setMute(true, 'Voice mute-all toggle');
          await container.redis.sadd(affectedKey, userId);
          mutedCount++;
        } catch (err) {
          container.logger.warn(`[VoiceButtonInteraction] Failed to mute ${userId}:`, err);
        }
      }
    }

    // Set TTL on the sets
    if (ignoredCount > 0) {
      await container.redis.expire(ignoreKey, VOICE_CACHE_TTL.muteAllState);
    }
    if (mutedCount > 0) {
      await container.redis.expire(affectedKey, VOICE_CACHE_TTL.muteAllState);
    }

    // Save the state with expiresAt
    const state: VoiceMuteAllState = {
      enabled: true,
      enabledAt: now,
      expiresAt,
      initiatorId,
      channelId,
    };
    await setJson(stateKey, VoiceMuteAllStateSchema, state, VOICE_CACHE_TTL.muteAllState);

    // Schedule expiry job
    await voiceMuteAllScheduler.scheduleExpiry(guildId, channelId, MUTE_ALL_DURATION_MS);

    // Log to modlog (no DB case)
    await logVoiceMuteAllAction(
      ensureNonNull(
        interaction.guild,
        'voiceButtonInteraction > enableMuteAll > logVoiceMuteAllAction: interaction.guild'
      ),
      {
        enabled: true,
        channelId,
        channelName,
        moderatorId: initiatorId,
        moderatorTag: interaction.user.tag,
        affectedCount: mutedCount,
        ignoredCount,
      }
    );

    const exemptText = exemptCount > 0 ? ` (${exemptCount} exempt)` : '';
    await interaction.editReply({
      content: `**Mute All Enabled** for **${channelName}**\nMuted **${mutedCount}** member(s), ignored **${ignoredCount}** already-muted${exemptText}.\n\nExpires <t:${Math.floor(expiresAt / 1000)}:R>. Click the button again to unmute.`,
    });
  }

  /**
   * Disable mute-all: unmute everyone except ignorelist/DB-muted users
   */
  private async disableMuteAll(
    interaction: ButtonInteraction,
    guildId: string,
    channelId: string,
    channelName: string
  ): Promise<void> {
    // Cancel the scheduled expiry job
    await voiceMuteAllScheduler.cancelExpiry(guildId, channelId);

    // Use the shared function to disable mute-all
    const result = await disableMuteAllForChannel(
      guildId,
      channelId,
      ensureNonNull(
        interaction.guild,
        'voiceButtonInteraction > disableMuteAll > disableMuteAllForChannel: interaction.guild'
      )
    );

    // Log to modlog (no DB case)
    await logVoiceMuteAllAction(
      ensureNonNull(
        interaction.guild,
        'voiceButtonInteraction > disableMuteAll > logVoiceMuteAllAction: interaction.guild'
      ),
      {
        enabled: false,
        channelId,
        channelName,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        affectedCount: result.unmutedCount,
        ignoredCount: result.ignoredCount,
      }
    );

    await interaction.editReply({
      content: `**Mute All Disabled** for **${channelName}**\nUnmuted **${result.unmutedCount}** member(s), ignored **${result.ignoredCount}** (already muted/DB muted).`,
    });
  }
}
