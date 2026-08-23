/**
 * ModLog Builders
 *
 * Components V2 builders for moderation log entries using the fluent container API.
 * These are designed to be:
 * - Readable and compact
 * - Non-pinging (no @mentions)
 * - Consistent emoji usage
 * - Footer with case number and timestamp
 */

import { MessageFlags } from 'discord.js';
import { ModAction } from '@prisma/client';
import {
  COLORS,
  formatDuration,
  container,
  type FluentContainer,
  formatUserMention,
  EMOJI,
  safeTag,
} from '#lib/discord/index.js';

// Types

export interface ModLogEntry {
  action: ModAction;
  caseNumber: number;
  targetId: string;
  targetTag?: string | null;
  moderatorId: string;
  moderatorTag?: string | null;
  reason: string;
  duration?: number | null;
  timestamp?: Date;
  /** Whether this was an automatic action (e.g., scheduled unmute, tempban expiry) */
  automatic?: boolean;
  /** Rolling count of recent offenses of the same type */
  recentOffenseCount?: number;
  /** Offense label used in summary (e.g. warn, mute) */
  offenseLabel?: string;
}

// Action Display Mapping

const ACTION_DISPLAY: Record<
  string,
  { emoji: string; label: string; color: number; pastTense: string }
> = {
  BAN: {
    emoji: EMOJI.MODERATION.ICONS.SHIELD_RED,
    label: 'Ban',
    color: COLORS.BAN,
    pastTense: 'banned',
  },
  UNBAN: {
    emoji: EMOJI.STATUS.SUCCESS,
    label: 'Unban',
    color: COLORS.SUCCESS,
    pastTense: 'unbanned',
  },
  KICK: {
    emoji: EMOJI.MODERATION.ACTIONS.KICK,
    label: 'Kick',
    color: COLORS.KICK,
    pastTense: 'kicked',
  },
  TIMEOUT: {
    emoji: EMOJI.TIME.TIMEOUT,
    label: 'Timeout',
    color: COLORS.TIMEOUT,
    pastTense: 'timed out',
  },
  WARN: { emoji: EMOJI.STATUS.WARNING, label: 'Warning', color: COLORS.WARN, pastTense: 'warned' },
  SOFTBAN: {
    emoji: EMOJI.UI.NAV.LEAVE_SERVER,
    label: 'Softban',
    color: 0xf57c00,
    pastTense: 'softbanned',
  },
  TEMPBAN: {
    emoji: EMOJI.UI.NAV.LEAVE_SERVER,
    label: 'Tempban',
    color: 0xb71c1c,
    pastTense: 'tempbanned',
  },
  MUTE_TEXT: {
    emoji: EMOJI.CHANNELS.STATE.TEXT_LIMITED_WHITE,
    label: 'Text mute',
    color: COLORS.MUTE,
    pastTense: 'text muted',
  },
  MUTE_VOICE: {
    emoji: EMOJI.CHANNELS.STATE.VOICE_LIMITED_WHITE,
    label: 'Voice mute',
    color: COLORS.MUTE,
    pastTense: 'voice muted',
  },
  MUTE_BOTH: {
    emoji: EMOJI.MODERATION.ICONS.CENSOR_ASTERISK,
    label: 'Full mute',
    color: COLORS.MUTE,
    pastTense: 'fully muted',
  },
  UNMUTE_TEXT: {
    emoji: EMOJI.CHANNELS.STATE.TEXT_CHECKED_WHITE,
    label: 'Text unmute',
    color: COLORS.UNMUTE,
    pastTense: 'text unmuted',
  },
  UNMUTE_VOICE: {
    emoji: EMOJI.CHANNELS.STATE.VOICE_CHECKED_WHITE,
    label: 'Voice unmute',
    color: COLORS.UNMUTE,
    pastTense: 'voice unmuted',
  },
  UNMUTE_BOTH: {
    emoji: EMOJI.MODERATION.ICONS.CENSOR_ASTERISK,
    label: 'Full unmute',
    color: COLORS.UNMUTE,
    pastTense: 'fully unmuted',
  },
};

const DEFAULT_DISPLAY = {
  emoji: EMOJI.STATUS.INFO,
  label: 'Action',
  color: COLORS.INFO,
  pastTense: 'actioned',
};

function formatOffenseOrdinal(count: number): string {
  if (count === 1) return 'first';
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${count}th`;
  }
  switch (count % 10) {
    case 1:
      return `${count}st`;
    case 2:
      return `${count}nd`;
    case 3:
      return `${count}rd`;
    default:
      return `${count}th`;
  }
}

/**
 *
 * @param entry - The mod log entry
 * @param offenseWindow - The number of days to look back for offenses
 * @returns The offense summary
 * @returns
 */
function buildOffenseSummary(entry: ModLogEntry, offenseWindow: number): string | null {
  if (!entry.offenseLabel || !entry.recentOffenseCount) return null;
  if (entry.action === ModAction.BAN) return null;
  const ordinal = formatOffenseOrdinal(entry.recentOffenseCount);
  return `This is their ${ordinal} ${entry.offenseLabel} in the last ${offenseWindow} days.`;
}

// Builders

/**
 * Build a fluent container for a modlog entry
 */
export function buildModLogEntry(entry: ModLogEntry): FluentContainer {
  const display = ACTION_DISPLAY[entry.action] ?? {
    ...DEFAULT_DISPLAY,
    label: entry.action,
    pastTense: entry.action.toLowerCase(),
  };

  // Target and moderator display (no pings)
  const targetDisplay = formatUserMention(entry.targetId);
  const modDisplay = entry.automatic
    ? '`System` (Automatic)'
    : formatUserMention(entry.moderatorId);

  // Build the container
  const offenseSummary = buildOffenseSummary(entry, 30);

  const c = container({ color: display.color })
    .h2(
      `${display.emoji} ${entry.targetTag ? safeTag(entry.targetTag) : entry.targetId} was ${display.pastTense}`
    )
    .text(
      [
        `**Reason**: ${entry.reason || 'No reason provided'}`,
        `**Duration**: ${entry.duration ? formatDuration(entry.duration) : 'N/A'}`,
        //  ...(entry.duration ? [`${EMOJI.MODERATION.ACTIONS.SLOWMODE} ${formatDuration(entry.duration)}`] : []),
      ].join('\n')
    )
    .text(offenseSummary ? `\n> ${offenseSummary}` : '> No offense summary available')
    .text(
      `\n-# Target: ${targetDisplay} (${entry.targetId})\n-# Moderator: ${modDisplay} (${entry.moderatorId})`
    );

  // Footer with case number and timestamp
  const timestamp = entry.timestamp ?? new Date();
  c.footerWithTimestamp(`Case #${entry.caseNumber}`, timestamp);

  return c;
}

/**
 * Get the message options for sending a modlog entry
 */
export function getModLogMessageOptions(entry: ModLogEntry): {
  components: [ReturnType<FluentContainer['build']>];
  flags: typeof MessageFlags.IsComponentsV2;
  allowedMentions: { parse: [] };
} {
  const fluentContainer = buildModLogEntry(entry);

  return {
    components: [fluentContainer.build()],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

/**
 * Get display info for a mod action (useful for building custom messages)
 */
export function getActionDisplay(action: ModAction) {
  return ACTION_DISPLAY[action] ?? { ...DEFAULT_DISPLAY, label: action };
}
