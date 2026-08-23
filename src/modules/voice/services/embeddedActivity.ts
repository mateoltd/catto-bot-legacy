import { container } from '@sapphire/framework';
import { CacheKey } from '#lib/cache/index.js';
import { VoiceWatchSessionSchema, VoiceTrackSessionSchema } from '../domain/types.js';
import { getJson } from '#lib/cache/index.js';
import { handleWatchUpdate, handleTrackUpdate } from './voiceUpdate.js';

/**
 * Discord Embedded Activity types and tracking
 *
 * Embedded Activities are interactive apps that run INSIDE Discord voice channels
 * (Watch Together, Poker Night, Chess, etc.) - distinct from presence activities
 * (playing external games, Spotify, custom status)
 *
 * Discord.js doesn't expose EMBEDDED_ACTIVITY_UPDATE_V2 events natively,
 * so we listen to raw gateway events and track state manually
 *
 * Gateway Event: EMBEDDED_ACTIVITY_UPDATE_V2
 * Intent Required: GUILD_EMBEDDED_ACTIVITIES (1 << 17)
 */

export interface EmbeddedActivityParticipant {
  userId: string;
  sessionId?: string;
}

export interface EmbeddedActivityLocation {
  id: string;
  kind: 'gc' | 'pc'; // gc = guild channel, pc = private channel
  channelId: string;
  guildId?: string;
}

export interface EmbeddedActivityInstance {
  applicationId: string;
  instanceId: string;
  launchId: string;
  location: EmbeddedActivityLocation;
  participants: EmbeddedActivityParticipant[];
}

/**
 * Raw payload structure from EMBEDDED_ACTIVITY_UPDATE_V2 gateway event
 * The structure may vary - Discord might send the activity nested or at top level
 */
export interface RawEmbeddedActivityUpdate {
  // The event may contain the activity nested under embedded_activity
  embedded_activity?: {
    application_id: string;
    instance_id?: string;
    launch_id?: string;
    location?: {
      id?: string;
      kind?: string;
      channel_id: string;
      guild_id?: string;
    };
    participants?: Array<{
      user_id: string;
      session_id?: string;
    }>;
  } | null;
  // Or the activity fields might be at the top level
  application_id?: string;
  instance_id?: string;
  launch_id?: string;
  location?: {
    id?: string;
    kind?: string;
    channel_id: string;
    guild_id?: string;
  };
  participants?: Array<{
    user_id: string;
    session_id?: string;
  }>;
  // Additional fields that may be present
  guild_id?: string;
  channel_id?: string;
  // Some payloads use 'users' instead of 'participants'
  users?: string[];
}

/**
 * In-memory store for tracking which users are in embedded activities
 * Key: `${guildId}:${channelId}:${userId}` -> activity application ID
 *
 * We also track by channel to know if any activity is running in a channel
 */
class EmbeddedActivityTracker {
  // userId -> Set of channelIds where they're in an activity
  private userActivities = new Map<string, Set<string>>();

  // channelId -> Set of userIds in activities in that channel
  private channelActivities = new Map<string, Set<string>>();

  // channelId -> applicationId (which activity is running)
  private channelApplications = new Map<string, string>();

  /**
   * Check if a user is in an embedded activity in any channel
   */
  isUserInActivity(userId: string): boolean {
    const channels = this.userActivities.get(userId);
    return channels !== undefined && channels.size > 0;
  }

  /**
   * Check if a user is in an embedded activity in a specific channel
   */
  isUserInActivityInChannel(userId: string, channelId: string): boolean {
    const channels = this.userActivities.get(userId);
    return channels?.has(channelId) ?? false;
  }

  /**
   * Check if a channel has any active embedded activity
   */
  hasActivityInChannel(channelId: string): boolean {
    const users = this.channelActivities.get(channelId);
    return users !== undefined && users.size > 0;
  }

  /**
   * Get the application ID of the activity in a channel
   */
  getChannelActivityApp(channelId: string): string | undefined {
    return this.channelApplications.get(channelId);
  }

  /**
   * Get all users in an activity in a channel
   */
  getUsersInActivity(channelId: string): string[] {
    const users = this.channelActivities.get(channelId);
    return users ? Array.from(users) : [];
  }

  /**
   * Update activity state from a gateway event.
   * Handles multiple possible payload structures from Discord
   */
  updateFromEvent(payload: RawEmbeddedActivityUpdate): {
    guildId?: string;
    channelId?: string;
    affectedUsers: string[];
  } {
    // Try to extract activity from nested or top-level structure
    const nestedActivity = payload.embedded_activity;
    const hasNestedActivity = nestedActivity && typeof nestedActivity === 'object';

    container.logger.debug(`[EmbeddedActivity] hasNestedActivity: ${hasNestedActivity}`);

    // Extract fields - prefer nested, fallback to top-level
    const applicationId = hasNestedActivity
      ? nestedActivity.application_id
      : payload.application_id;

    const location = hasNestedActivity ? nestedActivity.location : payload.location;

    container.logger.debug(`[EmbeddedActivity] location: ${JSON.stringify(location)}`);

    // Extract participants - could be in nested activity, top-level, or as 'users' array
    let participantUserIds: string[] = [];
    if (hasNestedActivity && nestedActivity.participants?.length) {
      participantUserIds = nestedActivity.participants.map((p) => p.user_id);
      container.logger.debug('[EmbeddedActivity] Using nested participants');
    } else if (payload.participants?.length) {
      participantUserIds = payload.participants.map((p) => p.user_id);
      container.logger.debug('[EmbeddedActivity] Using top-level participants');
    } else if (payload.users?.length) {
      // Some payloads use 'users' as a simple array of user IDs
      participantUserIds = payload.users;
      container.logger.debug('[EmbeddedActivity] Using users array');
    }

    container.logger.debug(
      `[EmbeddedActivity] participantUserIds: ${JSON.stringify(participantUserIds)}`
    );

    // Extract guild and channel IDs
    const guildId = payload.guild_id ?? location?.guild_id;
    const channelId = payload.channel_id ?? location?.channel_id;

    container.logger.debug(
      `[EmbeddedActivity] Extracted guildId=${guildId}, channelId=${channelId}`
    );

    if (!channelId) {
      return { affectedUsers: [] };
    }

    // Get previous users in this channel's activity
    const previousUsers = new Set(this.channelActivities.get(channelId) ?? []);

    // If no participants, activity ended - clear all users from this channel
    if (participantUserIds.length === 0) {
      const affectedUsers = Array.from(previousUsers);

      for (const userId of previousUsers) {
        this.removeUserFromChannel(userId, channelId);
      }

      this.channelActivities.delete(channelId);
      this.channelApplications.delete(channelId);

      return { guildId, channelId, affectedUsers };
    }

    // Activity is active - update state
    const currentUsers = new Set(participantUserIds);

    // Track application if we have it
    if (applicationId) {
      this.channelApplications.set(channelId, applicationId);
    }

    // Find users who left the activity
    for (const userId of previousUsers) {
      if (!currentUsers.has(userId)) {
        this.removeUserFromChannel(userId, channelId);
      }
    }

    // Find users who joined the activity
    for (const userId of currentUsers) {
      if (!previousUsers.has(userId)) {
        this.addUserToChannel(userId, channelId);
      }
    }

    // Update channel's user set
    this.channelActivities.set(channelId, currentUsers);

    // Return all affected users (both joined and left)
    const allAffected = new Set([...previousUsers, ...currentUsers]);
    return { guildId, channelId, affectedUsers: Array.from(allAffected) };
  }

  private addUserToChannel(userId: string, channelId: string): void {
    let channels = this.userActivities.get(userId);
    if (!channels) {
      channels = new Set();
      this.userActivities.set(userId, channels);
    }
    channels.add(channelId);
  }

  private removeUserFromChannel(userId: string, channelId: string): void {
    const channels = this.userActivities.get(userId);
    if (channels) {
      channels.delete(channelId);
      if (channels.size === 0) {
        this.userActivities.delete(userId);
      }
    }
  }

  /**
   * Clear all state (for reconnects)
   */
  clear(): void {
    this.userActivities.clear();
    this.channelActivities.clear();
    this.channelApplications.clear();
  }
}

// Singleton instance
export const embeddedActivityTracker = new EmbeddedActivityTracker();

/**
 * Handle an embedded activity update from raw gateway event
 * This triggers updates to any active watch/track sessions
 */
export async function handleEmbeddedActivityUpdate(
  payload: RawEmbeddedActivityUpdate
): Promise<void> {
  container.logger.debug('[EmbeddedActivity] Processing payload...');
  const { guildId, channelId, affectedUsers } = embeddedActivityTracker.updateFromEvent(payload);

  container.logger.debug(
    `[EmbeddedActivity] Update result: guildId=${guildId}, channelId=${channelId}, affectedUsers=${JSON.stringify(affectedUsers)}`
  );

  if (!guildId || !channelId || affectedUsers.length === 0) {
    container.logger.debug(
      '[EmbeddedActivity] Skipping - missing guildId, channelId, or no affected users'
    );
    return;
  }

  try {
    // Notify watch sessions for affected users
    for (const userId of affectedUsers) {
      const watchKey = CacheKey.voiceWatchByTarget(guildId, userId);
      const watchInteractionIds = await container.redis.smembers(watchKey);

      container.logger.debug(
        `[EmbeddedActivity] Watch sessions for user ${userId}: ${JSON.stringify(watchInteractionIds)}`
      );

      for (const interactionId of watchInteractionIds) {
        const sessionKey = CacheKey.voiceWatch(guildId, interactionId);
        const session = await getJson(sessionKey, VoiceWatchSessionSchema);

        if (session && session.endsAt > Date.now()) {
          const guild = container.client.guilds.cache.get(guildId);
          const member = guild?.members.cache.get(userId);
          container.logger.debug(
            `[EmbeddedActivity] Triggering watch update for session ${interactionId}, member found: ${!!member}, voice: ${!!member?.voice}`
          );
          if (member?.voice) {
            await handleWatchUpdate(guildId, interactionId, session, member.voice);
          }
        }
      }
    }

    // Notify track sessions for the channel
    const trackKey = CacheKey.voiceTrackByChannel(guildId, channelId);
    const trackInteractionIds = await container.redis.smembers(trackKey);

    container.logger.debug(
      `[EmbeddedActivity] Track sessions for channel ${channelId}: ${JSON.stringify(trackInteractionIds)}`
    );

    for (const interactionId of trackInteractionIds) {
      const sessionKey = CacheKey.voiceTrack(guildId, interactionId);
      const session = await getJson(sessionKey, VoiceTrackSessionSchema);

      if (session && session.endsAt > Date.now()) {
        const guild = container.client.guilds.cache.get(guildId);
        container.logger.debug(
          `[EmbeddedActivity] Triggering track update for session ${interactionId}`
        );
        if (guild) {
          await handleTrackUpdate(guildId, interactionId, session, channelId, guild);
        }
      }
    }
  } catch (error) {
    container.logger.error('[EmbeddedActivity] Error handling activity update:', error);
  }
}
