import { Listener, container } from '@sapphire/framework';
import { Events, PermissionFlagsBits, type VoiceState } from 'discord.js';
import { MuteType } from '@prisma/client';
import { setJson, deleteJson, getJson, CacheKey } from '#lib/cache/index.js';
import {
  VoiceMemberPresenceSchema,
  VoiceWatchSessionSchema,
  VoiceTrackSessionSchema,
  VoiceMuteAllStateSchema,
  VOICE_CACHE_TTL,
  type VoiceMemberPresence,
} from '#root/modules/voice/domain/types.js';
import { handleWatchUpdate, handleTrackUpdate } from '#root/modules/voice/services/voiceUpdate.js';
import { muteService } from '#root/modules/moderation/services/MuteService.js';
import { asGuildId } from '#root/modules/moderation/domain/types.js';

export class VoiceStateUpdateListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.VoiceStateUpdate,
    });
  }

  public async run(oldState: VoiceState, newState: VoiceState) {
    const guildId = newState.guild.id;
    const userId = newState.member?.id ?? newState.id;

    try {
      // Handle channel membership sets
      await this.updateChannelMembership(guildId, oldState, newState, userId);

      // Handle member presence
      await this.updateMemberPresence(guildId, userId, newState);

      // Publish for active watchers (listener-driven updates)
      await this.notifyWatchers(guildId, userId, oldState, newState);

      // Handle voice mute state when user joins a voice channel
      // This will reapply mutes for active mutes, or remove stale mutes for expired ones
      if (!oldState.channelId && newState.channelId && newState.member) {
        await muteService.handleVoiceJoin(asGuildId(guildId), newState.member);
      }

      // Handle mute-all toggle enforcement
      await this.handleMuteAllEnforcement(guildId, oldState, newState, userId);
    } catch (error) {
      container.logger.error('[VoiceStateUpdate] Error processing voice state update:', error);
    }
  }

  private async updateChannelMembership(
    guildId: string,
    oldState: VoiceState,
    newState: VoiceState,
    userId: string
  ): Promise<void> {
    // Remove from old channel set if they left
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const oldKey = CacheKey.voiceChannelMembers(guildId, oldState.channelId);
      await container.redis.srem(oldKey, userId);

      // Check if channel is now empty and clean up
      const remaining = await container.redis.scard(oldKey);
      if (remaining === 0) {
        await container.redis.del(oldKey);
      }
    }

    // Add to new channel set if they joined
    if (newState.channelId) {
      const newKey = CacheKey.voiceChannelMembers(guildId, newState.channelId);
      await container.redis.sadd(newKey, userId);
      await container.redis.expire(newKey, VOICE_CACHE_TTL.memberPresence);
    }
  }

  private async updateMemberPresence(
    guildId: string,
    userId: string,
    state: VoiceState
  ): Promise<void> {
    const key = CacheKey.voiceMemberPresence(guildId, userId);

    if (!state.channelId) {
      // User left voice - delete presence
      await deleteJson(key);
      return;
    }

    const presence: VoiceMemberPresence = {
      channelId: state.channelId,
      selfMute: state.selfMute ?? false,
      selfDeaf: state.selfDeaf ?? false,
      serverMute: state.serverMute ?? false,
      serverDeaf: state.serverDeaf ?? false,
      streaming: state.streaming ?? false,
      timestamp: Date.now(),
    };

    await setJson(key, VoiceMemberPresenceSchema, presence, VOICE_CACHE_TTL.memberPresence);
  }

  private async notifyWatchers(
    guildId: string,
    userId: string,
    oldState: VoiceState,
    newState: VoiceState
  ): Promise<void> {
    // Check for user watchers
    const watchKey = CacheKey.voiceWatchByTarget(guildId, userId);
    const watchInteractionIds = await container.redis.smembers(watchKey);

    for (const interactionId of watchInteractionIds) {
      const sessionKey = CacheKey.voiceWatch(guildId, interactionId);
      const session = await getJson(sessionKey, VoiceWatchSessionSchema);

      if (session && session.endsAt > Date.now()) {
        await handleWatchUpdate(guildId, interactionId, session, newState);
      }
    }

    // Check for channel trackers - handle both old and new channel
    const channelIds = new Set<string>();
    if (oldState.channelId) channelIds.add(oldState.channelId);
    if (newState.channelId) channelIds.add(newState.channelId);

    for (const channelId of channelIds) {
      const trackKey = CacheKey.voiceTrackByChannel(guildId, channelId);
      const trackInteractionIds = await container.redis.smembers(trackKey);

      for (const interactionId of trackInteractionIds) {
        const sessionKey = CacheKey.voiceTrack(guildId, interactionId);
        const session = await getJson(sessionKey, VoiceTrackSessionSchema);

        if (session && session.endsAt > Date.now()) {
          await handleTrackUpdate(guildId, interactionId, session, channelId, newState.guild);
        }
      }
    }
  }

  /**
   * Handle mute-all toggle enforcement (channel-scoped state machine):
   * - Auto-mute late joiners when mute-all is enabled for the channel they join
   * - Auto-unmute users when they leave/switch away from a mute-all channel
   */
  private async handleMuteAllEnforcement(
    guildId: string,
    oldState: VoiceState,
    newState: VoiceState,
    userId: string
  ): Promise<void> {
    const joinedChannel = !oldState.channelId && newState.channelId;
    const leftChannel = oldState.channelId && !newState.channelId;
    const switchedChannel =
      oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

    // Handle user leaving/switching away from a mute-all channel - UNMUTE them
    if ((leftChannel || switchedChannel) && oldState.channelId) {
      await this.handleMuteAllLeaver(guildId, oldState.channelId, userId, newState);
    }

    // Handle user joining/switching into a mute-all channel - MUTE them
    if ((joinedChannel || switchedChannel) && newState.channelId && newState.member) {
      await this.handleMuteAllJoiner(guildId, newState.channelId, userId, newState);
    }
  }

  /**
   * Auto-mute users joining a channel with mute-all enabled.
   * Exempt: initiator, voice mods, already server-muted users (added to ignore set).
   */
  private async handleMuteAllJoiner(
    guildId: string,
    channelId: string,
    userId: string,
    newState: VoiceState
  ): Promise<void> {
    const stateKey = CacheKey.voiceMuteAllState(guildId, channelId);
    const muteAllState = await getJson(stateKey, VoiceMuteAllStateSchema);

    // No active mute-all for this channel
    if (!muteAllState?.enabled) return;

    // Check if mute-all has expired (fallback check)
    if (Date.now() >= muteAllState.expiresAt) {
      container.logger.info(
        `[VoiceStateUpdate] Mute-all expired for channel ${channelId}, skipping late joiner enforcement`
      );
      return;
    }

    // Skip if this is the initiator
    if (userId === muteAllState.initiatorId) return;

    // Skip if user has MuteMembers permission (exempt - they can mute back)
    if (newState.member?.permissions.has(PermissionFlagsBits.MuteMembers)) {
      container.logger.debug(
        `[VoiceStateUpdate] Skipping mute-all for member with MuteMembers perm ${userId} in channel ${channelId}`
      );
      return;
    }

    const ignoreKey = CacheKey.voiceMuteAllIgnore(guildId, channelId);
    const affectedKey = CacheKey.voiceMuteAllAffected(guildId, channelId);

    // Check if user is already server-muted (add to ignore set, don't touch)
    if (newState.serverMute) {
      await container.redis.sadd(ignoreKey, userId);
      await container.redis.expire(ignoreKey, VOICE_CACHE_TTL.muteAllState);
      container.logger.info(
        `[VoiceStateUpdate] Late joiner ${userId} already muted, added to ignorelist for channel ${channelId}`
      );
      return;
    }

    // Mute the late joiner and add to affected set
    try {
      await newState.member?.voice.setMute(true, 'Voice mute-all: late joiner');
      await container.redis.sadd(affectedKey, userId);
      await container.redis.expire(affectedKey, VOICE_CACHE_TTL.muteAllState);
      container.logger.info(
        `[VoiceStateUpdate] Auto-muted late joiner ${userId} in channel ${channelId}`
      );
    } catch (error) {
      container.logger.warn(`[VoiceStateUpdate] Failed to auto-mute late joiner ${userId}:`, error);
    }
  }

  /**
   * Auto-unmute users leaving a channel with mute-all enabled.
   * Only unmutes users in the affected set (muted by mute-all) who don't have a DB voice mute.
   */
  private async handleMuteAllLeaver(
    guildId: string,
    channelId: string,
    userId: string,
    newState: VoiceState
  ): Promise<void> {
    const stateKey = CacheKey.voiceMuteAllState(guildId, channelId);
    const muteAllState = await getJson(stateKey, VoiceMuteAllStateSchema);

    // No active mute-all for this channel
    if (!muteAllState?.enabled) return;

    const ignoreKey = CacheKey.voiceMuteAllIgnore(guildId, channelId);
    const affectedKey = CacheKey.voiceMuteAllAffected(guildId, channelId);

    // Check if user was in the affected set (muted by mute-all)
    const isAffected = await container.redis.sismember(affectedKey, userId);
    if (!isAffected) return;

    // Check if user is in ignorelist (never auto-unmute these)
    const isIgnored = await container.redis.sismember(ignoreKey, userId);
    if (isIgnored) return;

    // Check if user has an active DB mute - if so, don't unmute
    const hasDbMute = await this.hasActiveVoiceMute(guildId, userId);
    if (hasDbMute) {
      container.logger.info(
        `[VoiceStateUpdate] Not unmuting leaver ${userId} - has active DB mute`
      );
      return;
    }

    // Remove from affected set
    await container.redis.srem(affectedKey, userId);

    // Unmute the user if they're still server-muted and have a voice state
    // (newState may be the new channel or null if they left entirely)
    if (newState.member?.voice.serverMute) {
      try {
        await newState.member.voice.setMute(false, 'Voice mute-all: left channel');
        container.logger.info(
          `[VoiceStateUpdate] Unmuted ${userId} after leaving mute-all channel ${channelId}`
        );
      } catch (error) {
        container.logger.warn(`[VoiceStateUpdate] Failed to unmute leaver ${userId}:`, error);
      }
    }
  }

  /**
   * Check if a user has an active voice mute in the database
   */
  private async hasActiveVoiceMute(guildId: string, userId: string): Promise<boolean> {
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
}
