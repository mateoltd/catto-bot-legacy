import { container as sapphireContainer } from '@sapphire/framework';
import { GuildMember, type User, type Guild, MessageFlags } from 'discord.js';
import { ModAction, CaseStatus } from '@prisma/client';
import type { DurationSeconds, CaseNumber } from '../../domain/types.js';
import {
  container,
  formatDuration,
  formatRelativeTimestamp,
  formatStatsLine,
  truncateText,
  EMOJI,
  COLORS,
  paginationRow,
  safeTag,
  type FluentContainer,
} from '#lib/discord/index.js';
import * as modV1 from './v1.js';
import {
  buildModLogEntry,
  getActionDisplay,
  getModLogMessageOptions,
  type ModLogEntry,
} from '../modlog.js';
import { ensureNonNull } from '#root/lib/utils.js';

// Re-export for convenience
export { formatDuration, type ModLogEntry };

/**
 * Check whether a case status is voided.
 */
export function isVoidCase(status?: CaseStatus): boolean {
  return status === CaseStatus.VOID;
}

/**
 * Apply strikethrough to text when voided.
 */
export function voidStrike(text: string, status?: CaseStatus): string {
  return isVoidCase(status) ? `~~${text}~~` : text;
}

const OFFENSE_WINDOW_DAYS = 30;

const OFFENSE_GROUPS: Partial<Record<ModAction, { label: string; actions: ModAction[] }>> = {
  [ModAction.WARN]: { label: 'warn', actions: [ModAction.WARN] },
  [ModAction.TIMEOUT]: { label: 'timeout', actions: [ModAction.TIMEOUT] },
  [ModAction.KICK]: { label: 'kick', actions: [ModAction.KICK] },
  [ModAction.SOFTBAN]: { label: 'softban', actions: [ModAction.SOFTBAN] },
  [ModAction.TEMPBAN]: { label: 'tempban', actions: [ModAction.TEMPBAN] },
  [ModAction.MUTE_TEXT]: {
    label: 'mute',
    actions: [ModAction.MUTE_TEXT, ModAction.MUTE_VOICE, ModAction.MUTE_BOTH],
  },
  [ModAction.MUTE_VOICE]: {
    label: 'mute',
    actions: [ModAction.MUTE_TEXT, ModAction.MUTE_VOICE, ModAction.MUTE_BOTH],
  },
  [ModAction.MUTE_BOTH]: {
    label: 'mute',
    actions: [ModAction.MUTE_TEXT, ModAction.MUTE_VOICE, ModAction.MUTE_BOTH],
  },
};

// Re-export from modlog for backward compatibility during migration
export { buildModLogEntry, getModLogMessageOptions };

const NOTIFICATION_FLAGS = MessageFlags.IsComponentsV2;

const MOD_ACTION_NOTIFICATIONS: Record<ModAction, { verb: string; emoji: string; color: number }> =
  {
    [ModAction.WARN]: { verb: 'warned', emoji: EMOJI.STATUS.WARNING, color: COLORS.WARN },
    [ModAction.KICK]: { verb: 'kicked', emoji: EMOJI.UI.NAV.LEAVE_SERVER, color: COLORS.KICK },
    [ModAction.BAN]: {
      verb: 'banned',
      emoji: EMOJI.MODERATION.ICONS.SHIELD_RED,
      color: COLORS.BAN,
    },
    [ModAction.SOFTBAN]: {
      verb: 'softbanned',
      emoji: EMOJI.MODERATION.ICONS.SHIELD_RED,
      color: COLORS.BAN,
    },
    [ModAction.TEMPBAN]: {
      verb: 'temporarily banned',
      emoji: EMOJI.MODERATION.ICONS.SHIELD_RED,
      color: COLORS.BAN,
    },
    [ModAction.TIMEOUT]: { verb: 'timed out', emoji: EMOJI.TIME.TIMEOUT, color: COLORS.TIMEOUT },
    [ModAction.MUTE_TEXT]: {
      verb: 'muted (text)',
      emoji: EMOJI.CHANNELS.STATE.TEXT_LIMITED_WHITE,
      color: COLORS.MUTE,
    },
    [ModAction.MUTE_VOICE]: {
      verb: 'muted (voice)',
      emoji: EMOJI.VOICE.STATE.SERVER_MUTED,
      color: COLORS.MUTE,
    },
    [ModAction.MUTE_BOTH]: {
      verb: 'muted',
      emoji: EMOJI.CHANNELS.STATE.LOCKED,
      color: COLORS.MUTE,
    },
    [ModAction.UNMUTE_TEXT]: {
      verb: 'unmuted (text)',
      emoji: EMOJI.CHANNELS.STATE.TEXT_CHECKED_WHITE,
      color: COLORS.UNMUTE,
    },
    [ModAction.UNMUTE_VOICE]: {
      verb: 'unmuted (voice)',
      emoji: EMOJI.CHANNELS.STATE.VOICE_CHECKED_WHITE,
      color: COLORS.UNMUTE,
    },
    [ModAction.UNMUTE_BOTH]: { verb: 'unmuted', emoji: EMOJI.STATUS.SUCCESS, color: COLORS.UNMUTE },
    [ModAction.UNBAN]: { verb: 'unbanned', emoji: EMOJI.STATUS.SUCCESS, color: COLORS.SUCCESS },
  };

/**
 * Create an embed for a moderation action
 */
export function createModEmbed(
  action: ModAction,
  target: User | GuildMember,
  moderator: User,
  reason: string,
  caseNumber?: CaseNumber,
  duration?: DurationSeconds
) {
  const targetUser = target instanceof GuildMember ? target.user : target;

  return modV1.buildModActionEmbed(
    action,
    { tag: safeTag(targetUser.tag), id: target.id },
    { tag: safeTag(moderator.tag), id: moderator.id },
    reason || 'No reason provided',
    {
      caseNumber,
      duration,
    }
  );
}

/**
 * Create a DM notification message for the target user using DCB.
 */
export function createUserNotificationEmbed(
  action: ModAction,
  guild: Guild,
  reason: string,
  duration?: DurationSeconds
): FluentContainer {
  const notification =
    MOD_ACTION_NOTIFICATIONS[action] ??
    ({
      verb: action.toLowerCase(),
      emoji: EMOJI.MODERATION.ICONS.CENSOR_ASTERISK,
      color: COLORS.INFO,
    } as const);

  const resolvedReason = reason || 'No reason provided';
  const details = [
    `**Server:** ${guild.name}`,
    `**Reason:** ${resolvedReason}`,
    duration ? `**Duration:** ${formatDuration(duration)}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const c = container({ color: notification.color })
    .h2(`${notification.emoji} You have been ${notification.verb}`)
    .text(details)
    .footerWithTimestamp();

  return c;
}

/**
 * Send a DM to the target user
 */
export async function notifyUser(
  target: User | GuildMember,
  action: ModAction,
  guild: Guild,
  reason: string,
  duration?: DurationSeconds
): Promise<boolean> {
  try {
    const user = target instanceof GuildMember ? target.user : target;
    const message = createUserNotificationEmbed(action, guild, reason, duration);

    await user.send({
      components: [message.build()],
      flags: NOTIFICATION_FLAGS,
    });
    return true;
  } catch {
    sapphireContainer.logger.warn(`Failed to DM user ${target.id}`);
    return false;
  }
}

/**
 * Log moderation action to mod log channel
 * Non-pinging, readable, consistent format
 */
export async function logToModChannel(guild: Guild, entry: ModLogEntry): Promise<void> {
  try {
    const modConfig = await sapphireContainer.prisma.modConfig.findUnique({
      where: { guildId: guild.id },
    });

    if (!modConfig?.modLogChannelId) {
      return;
    }

    const channel = await guild.channels.fetch(modConfig.modLogChannelId);
    if (channel?.isTextBased()) {
      const messageOptions = getModLogMessageOptions(entry);
      await channel.send(messageOptions);
    }
  } catch (error) {
    sapphireContainer.logger.error('Failed to log to mod channel:', error);
  }
}

/**
 * Log a moderation action to the mod channel
 * Convenience wrapper that constructs the ModLogEntry from common parameters
 */
export async function logModAction(
  guild: Guild,
  action: ModAction,
  target: User | GuildMember | { id: string; tag?: string },
  moderator: User | 'System',
  reason: string,
  caseNumber: CaseNumber,
  duration?: number,
  options?: { automatic?: boolean }
): Promise<void> {
  const targetUser = target instanceof GuildMember ? target.user : target;
  const isAutomatic = options?.automatic ?? moderator === 'System';
  const offenseGroup = OFFENSE_GROUPS[action];
  const shouldIncludeOffenseSummary = offenseGroup && action !== ModAction.BAN;
  let recentOffenseCount: number | undefined;
  let offenseLabel: string | undefined;

  if (shouldIncludeOffenseSummary) {
    const since = new Date(Date.now() - OFFENSE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    recentOffenseCount = await sapphireContainer.prisma.modCase.count({
      where: {
        guildId: guild.id,
        targetId: targetUser.id,
        action: { in: offenseGroup.actions },
        createdAt: { gte: since },
      },
    });
    offenseLabel = offenseGroup.label;
  }

  const entry: ModLogEntry = {
    action,
    caseNumber,
    targetId: targetUser.id,
    targetTag: 'tag' in targetUser ? targetUser.tag : undefined,
    moderatorId: moderator === 'System' ? 'System' : moderator.id,
    moderatorTag: moderator === 'System' ? 'System' : moderator.tag,
    reason: reason || 'No reason provided',
    duration,
    timestamp: new Date(),
    automatic: isAutomatic,
    recentOffenseCount,
    offenseLabel,
  };
  await logToModChannel(guild, entry);
}

// Legacy V2 aliases (for backward compatibility during migration)

/** @deprecated Use logToModChannel instead */
export const logToModChannelV2 = logToModChannel;

/** @deprecated Use buildModLogEntry instead */
export const buildModLogEntryV2 = buildModLogEntry;

// Embed Presets

/**
 * Create a case details embed
 */
export function createCaseEmbed(modCase: {
  caseNumber: number;
  action: ModAction;
  status?: CaseStatus;
  targetTag: string;
  targetId: string;
  moderatorTag: string;
  moderatorId: string;
  reason: string | null;
  createdAt: Date;
  duration: number | null;
  expiresAt: Date | null;
  guildId: string;
  evidenceCount?: number;
}): FluentContainer {
  const display = getActionDisplay(modCase.action);
  const reason = '`' + (modCase.reason ?? 'No reason provided') + '`';
  const voided = isVoidCase(modCase.status);
  const s = modCase.status;
  return container({ color: voided ? COLORS.NEUTRAL : display.color })
    .h2(`${display.emoji} ${voidStrike(`Case #${modCase.caseNumber}`, s)}`)
    .text(
      `**Action**: ${display.label ?? modCase.action}
**Reason**: ${reason}`
    )
    .when(!!modCase.duration, (c) =>
      c.text(
        `> ${EMOJI.MODERATION.ACTIONS.SLOWMODE} ${formatDuration(ensureNonNull(modCase.duration, 'presets > createCaseEmbed(270): modCase.duration'))}`
      )
    )
    .when(!!modCase.expiresAt, (c) =>
      c.text(
        `> ${EMOJI.TIME.EXPIRED} ${formatRelativeTimestamp(ensureNonNull(modCase.expiresAt, 'presets > createCaseEmbed(274): modCase.expiresAt'))}`
      )
    )
    .text(
      `-# Target: <@${modCase.targetId}> (${modCase.targetId})
-# Moderator: ${modCase.moderatorId === 'System' ? 'System' : `<@${modCase.moderatorId}> (${modCase.moderatorId})`}`
    )
    .when(modCase.evidenceCount !== undefined && modCase.evidenceCount > 0, (c) =>
      c.text(`> Evidence: ${modCase.evidenceCount} item(s)`)
    )
    .footerWithTimestamp(`Case #${modCase.caseNumber}`, modCase.createdAt);
}

export interface HistoryCase {
  caseNumber: number;
  action: ModAction;
  status?: CaseStatus;
  createdAt: Date;
  reason: string | null;
}

export interface HistoryEmbedOptions {
  page?: number;
  pageSize?: number;
  paginationCustomIdBase?: string;
}

const HISTORY_PAGE_SIZE = 5;

/**
 * Create a paginated history embed
 */
export function createHistoryEmbed(
  target: User,
  cases: HistoryCase[],
  options: HistoryEmbedOptions = {}
): FluentContainer {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? HISTORY_PAGE_SIZE;
  const totalPages = Math.ceil(cases.length / pageSize) || 1;
  const startIdx = (page - 1) * pageSize;
  const pageCases = cases.slice(startIdx, startIdx + pageSize);

  const stats = {
    Total: cases.length,
    Bans: cases.filter((c) => c.action === ModAction.BAN || c.action === ModAction.TEMPBAN).length,
    Kicks: cases.filter((c) => c.action === ModAction.KICK).length,
    Timeouts: cases.filter((c) => c.action === ModAction.TIMEOUT).length,
    Warns: cases.filter((c) => c.action === ModAction.WARN).length,
  };

  const caseList = pageCases
    .map((c) => {
      const display = getActionDisplay(c.action);
      const timestamp = formatRelativeTimestamp(c.createdAt);
      const reasonPreview = c.reason ? truncateText(c.reason, 50) : 'No reason provided';
      const reasonDisplay = `\`${reasonPreview}\``;
      return `**${voidStrike(`#${c.caseNumber} ${display.label}`, c.status)}** · ${timestamp}\n> Why: ${voidStrike(reasonDisplay, c.status)}`;
    })
    .join('\n');

  const header = `${EMOJI.USER.ICONS.MEMBER} ${safeTag(target.tag)} (\`${target.id}\`)`;
  const c = container({ color: COLORS.WARN })
    .beginSection()
    .h2(`${EMOJI.MODERATION.ICONS.CENSOR_ASTERISK} Moderation history`)
    .text(header)
    .text(formatStatsLine(stats, 'columns'))
    .withThumbnail(target.displayAvatarURL())
    .separator({ divider: true, spacing: 'small' });

  if (pageCases.length > 0) {
    c.separator();
    c.text(`**Cases (page ${page} of ${totalPages})**\n\n${caseList}`);
  } else {
    c.text('No cases found.');
  }

  if (totalPages > 1 && options.paginationCustomIdBase) {
    c.actions(
      paginationRow(options.paginationCustomIdBase, page, totalPages, {
        showFirst: false,
        showLast: false,
      })
    );
  }

  c.footer(`Use /mod case <number> to view specific cases.`);

  return c;
}

// Voice Mute-All Modlog Summary

export interface VoiceMuteAllLogEntry {
  /** Whether mute-all was enabled (true) or disabled (false) */
  enabled: boolean;
  /** Voice channel ID */
  channelId: string;
  /** Voice channel name */
  channelName: string;
  /** User who triggered the toggle */
  moderatorId: string;
  /** Tag of the moderator */
  moderatorTag: string;
  /** Number of users muted (on enable) or unmuted (on disable) */
  affectedCount: number;
  /** Number of users in the ignorelist (already muted before toggle) */
  ignoredCount: number;
  /** Number of users pending unmute on next join (on disable only) */
  pendingUnmuteCount?: number;
}

/**
 * Build a modlog entry for voice mute-all toggle actions.
 * This is a special entry that doesn't create a DB case.
 */
export function buildVoiceMuteAllLogEntry(entry: VoiceMuteAllLogEntry): FluentContainer {
  const emoji = entry.enabled
    ? EMOJI.VOICE.STATE.SERVER_MUTED
    : EMOJI.CHANNELS.STATE.VOICE_CHECKED_WHITE;
  const color = entry.enabled ? COLORS.MUTE : COLORS.UNMUTE;
  const action = entry.enabled ? 'Mute All Enabled' : 'Mute All Disabled';

  const details = [
    `**Channel:** <#${entry.channelId}>`,
    `**${entry.enabled ? 'Muted' : 'Unmuted'}:** ${entry.affectedCount} member(s)`,
    `**Ignored (already muted):** ${entry.ignoredCount} member(s)`,
  ];

  if (!entry.enabled && entry.pendingUnmuteCount !== undefined && entry.pendingUnmuteCount > 0) {
    details.push(`**Pending unmute on rejoin:** ${entry.pendingUnmuteCount} member(s)`);
  }

  const c = container({ color })
    .h2(`${emoji} Voice ${action}`)
    .text(details.join('\n'))
    .text(`\n-# Moderator: <@${entry.moderatorId}> (${entry.moderatorId})`)
    .footerWithTimestamp(`Voice Channel: ${entry.channelName}`);

  return c;
}

/**
 * Log a voice mute-all action to the mod channel.
 * This does NOT create a DB case - it's for auditing only.
 */
export async function logVoiceMuteAllAction(
  guild: Guild,
  entry: VoiceMuteAllLogEntry
): Promise<void> {
  try {
    const modConfig = await sapphireContainer.prisma.modConfig.findUnique({
      where: { guildId: guild.id },
    });

    if (!modConfig?.modLogChannelId) {
      return;
    }

    const channel = await guild.channels.fetch(modConfig.modLogChannelId);
    if (channel?.isTextBased()) {
      const fluentContainer = buildVoiceMuteAllLogEntry(entry);
      await channel.send({
        components: [fluentContainer.build()],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
      });
    }
  } catch (error) {
    sapphireContainer.logger.error('Failed to log voice mute-all action to mod channel:', error);
  }
}
