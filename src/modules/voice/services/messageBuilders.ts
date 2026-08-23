import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Guild,
  type VoiceState,
  type GuildMember,
  channelMention,
  userMention,
} from 'discord.js';
import {
  type VoiceWatchSession,
  type VoiceTrackSession,
  VOICE_WATCH_CONFIG,
} from '../domain/types.js';
import { EMOJI, container, type FluentContainer } from '#lib/discord/index.js';
import { embeddedActivityTracker } from './embeddedActivity.js';
import { hasVoiceModPermissions } from '#lib/validation/permissions.js';

// Re-export for backward compatibility
export { hasVoiceModPermissions };

/**
 * Get the mod shield indicator if a member has voice moderation permissions
 */
export function getModShieldIndicator(member: GuildMember): string {
  return hasVoiceModPermissions(member) ? EMOJI.MODERATION.ICONS.SHIELD_BLUE : '';
}

/**
 * Format a member's display name with mod shield if applicable
 */
export function formatMemberName(member: GuildMember): string {
  const modShield = getModShieldIndicator(member);
  return modShield ? `${member.displayName}` : member.displayName;
}

/**
 * Format a member line with voice indicators and optional mod shield
 */
export function formatVoiceMemberLine(
  member: GuildMember,
  options?: { useMention?: boolean; channelId?: string | null }
): string {
  const indicators = getVoiceIndicators(
    { ...member.voice, channelId: options?.channelId ?? member.voice.channelId },
    member.id
  );
  const modShield = getModShieldIndicator(member);
  const nameDisplay = options?.useMention ? userMention(member.id) : member.displayName;

  return `${indicators} ${nameDisplay} ${modShield}${modShield ? ' ' : ''}`;
}

export interface VoiceIndicatorOptions {
  selfMute?: boolean | null;
  selfDeaf?: boolean | null;
  serverMute?: boolean | null;
  serverDeaf?: boolean | null;
  streaming?: boolean | null;
  selfVideo?: boolean | null;
  // For embedded activity detection
  channelId?: string | null;
}

/**
 * Get voice state emoji indicators for a member.
 *
 * @param voice - Voice state properties (from member.voice)
 * @param userId - Optional user ID to check for embedded activity participation
 *
 * Discord embedded activities (Watch Together, Poker Night, etc.) are detected
 * via raw gateway events (EMBEDDED_ACTIVITY_UPDATE_V2) and tracked in memory.
 */
export function getVoiceIndicators(voice: VoiceIndicatorOptions, userId?: string): string {
  const indicators: string[] = [];

  if (voice.serverMute) {
    indicators.push(EMOJI.VOICE.STATE.SERVER_MUTED);
  } else if (voice.selfMute) {
    indicators.push(EMOJI.VOICE.STATE.MUTED);
  } else {
    indicators.push(EMOJI.VOICE.STATE.UNMUTED);
  }

  if (voice.serverDeaf) {
    indicators.push(EMOJI.VOICE.STATE.SERVER_DEAFENED);
  } else if (voice.selfDeaf) {
    indicators.push(EMOJI.VOICE.STATE.DEAFENED);
  } else {
    indicators.push(EMOJI.VOICE.STATE.UNDEAFENED);
  }

  if (voice.streaming) {
    indicators.push(EMOJI.VOICE.STATE.SCREENSHARE);
  }

  if (voice.selfVideo) {
    indicators.push(EMOJI.VOICE.STATE.VIDEO);
  }

  // Check for Discord embedded activity (Watch Together, Poker Night, etc.)
  // This is tracked via raw gateway events
  if (userId && voice.channelId) {
    if (embeddedActivityTracker.isUserInActivityInChannel(userId, voice.channelId)) {
      indicators.push(EMOJI.VOICE.ICONS.ACTIVITIES);
    }
  } else if (userId) {
    // Fallback: check if user is in any activity
    if (embeddedActivityTracker.isUserInActivity(userId)) {
      indicators.push(EMOJI.VOICE.ICONS.ACTIVITIES);
    }
  }

  return indicators.join(' ');
}

/**
 * Build watch message components with utility buttons
 */
export function buildWatchMessage(
  session: VoiceWatchSession,
  state: VoiceState,
  guild: Guild
): FluentContainer {
  const targetMember = guild.members.cache.get(session.targetId);
  const displayName = targetMember ? formatMemberName(targetMember) : session.targetId;
  const channel = state.channelId ? guild.channels.cache.get(state.channelId) : null;

  const c = container().h2(`${EMOJI.USER.ICONS.MEMBER} ${displayName}`);

  if (state.channelId && channel) {
    const indicators = getVoiceIndicators(
      { ...state, channelId: state.channelId },
      session.targetId
    );
    c.kv({
      Channel: channelMention(state.channelId),
      State: indicators,
    });

    if (state.streaming) {
      c.text(`${EMOJI.VOICE.STATE.SCREENSHARE} **Streaming**`);
    }
    if (state.selfVideo) {
      c.text(`${EMOJI.VOICE.STATE.VIDEO} **Video**`);
    }
  } else {
    c.text('_Not in a voice channel_');
  }

  c.separator().text(
    `${EMOJI.TIME.CLOCK} <t:${Math.floor(session.endsAt / 1000)}:R> • Updates: ${session.updateCount}/${VOICE_WATCH_CONFIG.maxUpdates}`
  );

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`voice_watch_stop:${session.targetId}`)
      .setEmoji(EMOJI.VOICE.CONTROLS.PAUSE)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`voice_refresh_watch:${session.targetId}`)
      .setEmoji(EMOJI.UI.NAV.REPLAY)
      .setStyle(ButtonStyle.Secondary)
  );

  if (state.channelId) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`voice_join:${state.channelId}`)
        .setEmoji(EMOJI.USER.ACTIONS.CONNECT)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`voice_mute:${session.targetId}`)
        .setEmoji(EMOJI.VOICE.CONTROLS.TOGGLE_MIC)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`voice_disconnect:${session.targetId}`)
        .setEmoji(EMOJI.USER.ACTIONS.DISCONNECT)
        .setStyle(ButtonStyle.Secondary)
    );
  }

  c.actions(actionRow);

  return c;
}

/**
 * Build track message components with utility buttons
 */
export function buildTrackMessage(
  session: VoiceTrackSession,
  voiceChannel: { name: string; members?: Map<string, unknown> },
  guild: Guild
): FluentContainer {
  const channel = guild.channels.cache.get(session.channelId);
  const members = channel?.isVoiceBased() ? channel.members : new Map();
  const memberCount = members.size;

  const memberLines = Array.from(members.values())
    .slice(0, 10)
    .map((m) => {
      const member = m as GuildMember;
      return formatVoiceMemberLine(member, { useMention: true, channelId: session.channelId });
    });

  const memberList = memberLines.length > 0 ? memberLines.join('\n') : '_No members_';

  const c = container()
    .h2(`${EMOJI.VOICE.ICONS.GENERIC} ${voiceChannel.name}`)
    .kv({
      Channel: channelMention(session.channelId),
      Members: memberCount.toString(),
    })
    .text(memberList);

  if (memberCount > 10) {
    c.text(`_... and ${memberCount - 10} more_`);
  }

  c.separator().text(
    `${EMOJI.TIME.CLOCK} <t:${Math.floor(session.endsAt / 1000)}:R> • Updates: ${session.updateCount}/${VOICE_WATCH_CONFIG.maxUpdates}`
  );

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`voice_track_stop:${session.channelId}`)
      .setEmoji(EMOJI.VOICE.CONTROLS.PAUSE)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`voice_refresh_track:${session.channelId}`)
      .setEmoji(EMOJI.UI.NAV.REPLAY)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`voice_join:${session.channelId}`)
      .setEmoji(EMOJI.USER.ACTIONS.CONNECT)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`voice_mute_all:${session.channelId}`)
      .setLabel('All')
      .setEmoji(EMOJI.VOICE.CONTROLS.TOGGLE_MIC)
      .setStyle(ButtonStyle.Secondary)
  );

  c.actions(actionRow);

  return c;
}

/**
 * Build ended watch message
 */
export function buildWatchEndedMessage(
  displayName: string,
  reason: string,
  durationMs: number,
  updateCount: number
): FluentContainer {
  return container()
    .h2(`Watch Ended: ${displayName}`)
    .kv({
      Reason: reason,
      Duration: formatDuration(durationMs),
      Updates: updateCount.toString(),
    });
}

/**
 * Build ended track message
 */
export function buildTrackEndedMessage(
  channelName: string,
  reason: string,
  durationMs: number,
  updateCount: number
): FluentContainer {
  return container()
    .h2(`Track Ended: ${channelName}`)
    .kv({
      Reason: reason,
      Duration: formatDuration(durationMs),
      Updates: updateCount.toString(),
    });
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// ============================================================================
// Shared builder params for command handlers
// ============================================================================

/**
 * Parameters for building a watch message from command handler context
 */
export interface WatchMessageParams {
  targetId: string;
  displayName: string;
  voiceState: VoiceIndicatorOptions & { channel?: { name: string } | null };
  endsAt: number;
  updateCount: number;
}

/**
 * Parameters for building a track message from command handler context
 */
export interface TrackMessageParams {
  channelId: string;
  channelName: string;
  members: Map<string, GuildMember>;
  endsAt: number;
  updateCount: number;
}

/**
 * Build watch message from command handler context (initial command reply)
 * Uses same layout as buildWatchMessage but accepts raw params instead of session
 */
export function buildWatchMessageFromParams(params: WatchMessageParams): FluentContainer {
  const c = container().h2(`${EMOJI.USER.ICONS.MEMBER} ${params.displayName}`);

  if (params.voiceState.channelId && params.voiceState.channel) {
    const indicators = getVoiceIndicators(params.voiceState, params.targetId);
    c.kv({
      Channel: channelMention(params.voiceState.channelId),
      State: indicators,
    });

    if (params.voiceState.streaming) {
      c.text(`${EMOJI.VOICE.STATE.SCREENSHARE} **Streaming**`);
    }
    if (params.voiceState.selfVideo) {
      c.text(`${EMOJI.VOICE.STATE.VIDEO} **Video**`);
    }
  } else {
    c.text('_Not in a voice channel_');
  }

  c.separator().text(
    `${EMOJI.TIME.CLOCK} <t:${Math.floor(params.endsAt / 1000)}:R> • Updates: ${params.updateCount}/${VOICE_WATCH_CONFIG.maxUpdates}`
  );

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`voice_watch_stop:${params.targetId}`)
      .setEmoji(EMOJI.VOICE.CONTROLS.PAUSE)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`voice_refresh_watch:${params.targetId}`)
      .setEmoji(EMOJI.UI.NAV.REPLAY)
      .setStyle(ButtonStyle.Secondary)
  );

  if (params.voiceState.channelId) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`voice_join:${params.voiceState.channelId}`)
        .setEmoji(EMOJI.USER.ACTIONS.CONNECT)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`voice_mute:${params.targetId}`)
        .setEmoji(EMOJI.VOICE.CONTROLS.TOGGLE_MIC)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`voice_disconnect:${params.targetId}`)
        .setEmoji(EMOJI.USER.ACTIONS.DISCONNECT)
        .setStyle(ButtonStyle.Secondary)
    );
  }

  c.actions(actionRow);

  return c;
}

/**
 * Build track message from command handler context (initial command reply)
 * Uses same layout as buildTrackMessage but accepts raw params instead of session
 */
export function buildTrackMessageFromParams(params: TrackMessageParams): FluentContainer {
  const memberCount = params.members.size;

  const memberLines = Array.from(params.members.values())
    .slice(0, 10)
    .map((member) =>
      formatVoiceMemberLine(member, { useMention: true, channelId: params.channelId })
    );

  const memberList = memberLines.length > 0 ? memberLines.join('\n') : '_No members_';

  const c = container()
    .h2(`${EMOJI.VOICE.ICONS.GENERIC} ${params.channelName}`)
    .kv({
      Channel: channelMention(params.channelId),
      Members: memberCount.toString(),
    })
    .text(memberList);

  if (memberCount > 10) {
    c.text(`_... and ${memberCount - 10} more_`);
  }

  c.separator().text(
    `${EMOJI.TIME.CLOCK} <t:${Math.floor(params.endsAt / 1000)}:R> • Updates: ${params.updateCount}/${VOICE_WATCH_CONFIG.maxUpdates}`
  );

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`voice_track_stop:${params.channelId}`)
      .setEmoji(EMOJI.VOICE.CONTROLS.PAUSE)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`voice_refresh_track:${params.channelId}`)
      .setEmoji(EMOJI.UI.NAV.REPLAY)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`voice_join:${params.channelId}`)
      .setEmoji(EMOJI.USER.ACTIONS.CONNECT)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`voice_mute_all:${params.channelId}`)
      .setLabel('All')
      .setEmoji(EMOJI.VOICE.CONTROLS.TOGGLE_MIC)
      .setStyle(ButtonStyle.Secondary)
  );

  c.actions(actionRow);

  return c;
}
