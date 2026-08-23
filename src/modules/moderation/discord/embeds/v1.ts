import { EmbedBuilder, type ColorResolvable, type User } from 'discord.js';
import { COLORS, EMOJI } from '#lib/discord/index.js';
import { formatRelativeTimestamp, formatDuration, truncateText } from '#lib/discord/index.js';
import { embed } from '#lib/discord/index.js';

/**
 * Moderation action types.
 */
export type ModActionType =
  | 'BAN'
  | 'UNBAN'
  | 'KICK'
  | 'TIMEOUT'
  | 'WARN'
  | 'MUTE'
  | 'UNMUTE'
  | 'SOFTBAN'
  | 'TEMPBAN';

/**
 * Colors for moderation actions.
 */
export const MOD_ACTION_COLORS: Record<string, ColorResolvable> = {
  BAN: COLORS.BAN,
  UNBAN: COLORS.SUCCESS,
  KICK: COLORS.KICK,
  TIMEOUT: COLORS.TIMEOUT,
  WARN: COLORS.WARN,
  MUTE: COLORS.MUTE,
  UNMUTE: COLORS.UNMUTE,
  SOFTBAN: 0xf57c00,
  TEMPBAN: 0xb71c1c,
  // Lowercase variants for flexibility
  ban: COLORS.BAN,
  unban: COLORS.SUCCESS,
  kick: COLORS.KICK,
  timeout: COLORS.TIMEOUT,
  warn: COLORS.WARN,
  mute: COLORS.MUTE,
  unmute: COLORS.UNMUTE,
  softban: 0xf57c00,
  tempban: 0xb71c1c,
};

export function buildModActionEmbed(
  action: string,
  target: { tag: string; id: string },
  moderator: { tag: string; id: string },
  reason: string,
  options?: {
    caseNumber?: number;
    duration?: number;
    color?: ColorResolvable;
  }
): EmbedBuilder {
  const color = options?.color ?? MOD_ACTION_COLORS[action] ?? COLORS.INFO;

  const e = embed(color)
    .setTitle(`${action}`)
    .addFields(
      { name: 'Target', value: `${target.tag} (\`${target.id}\`)`, inline: true },
      { name: 'Moderator', value: `${moderator.tag} (\`${moderator.id}\`)`, inline: true },
      { name: 'Reason', value: reason || 'No reason provided' }
    )
    .setTimestamp();

  if (options?.caseNumber !== undefined) {
    e.setFooter({ text: `Case #${options.caseNumber}` });
  }

  if (options?.duration !== undefined) {
    e.addFields({ name: 'Duration', value: formatDuration(options.duration) });
  }

  return e;
}

export function buildCaseEmbed(caseData: {
  caseNumber: number;
  action: string;
  targetTag: string;
  targetId: string;
  moderatorTag: string;
  moderatorId: string;
  reason: string | null;
  createdAt: Date;
  duration?: number | null;
  expiresAt?: Date | null;
  guildId?: string;
}): EmbedBuilder {
  const e = embed(COLORS.INFO)
    .setTitle(`Case #${caseData.caseNumber}`)
    .addFields(
      { name: 'Action', value: caseData.action, inline: true },
      { name: 'Target', value: `${caseData.targetTag}\n(\`${caseData.targetId}\`)`, inline: true },
      {
        name: 'Moderator',
        value: `${caseData.moderatorTag}\n(\`${caseData.moderatorId}\`)`,
        inline: true,
      },
      { name: 'Reason', value: caseData.reason ?? 'No reason provided' },
      { name: 'Date', value: formatRelativeTimestamp(caseData.createdAt), inline: true }
    );

  if (caseData.duration) {
    e.addFields({ name: 'Duration', value: formatDuration(caseData.duration), inline: true });
  }

  if (caseData.expiresAt) {
    e.addFields({
      name: 'Expires',
      value: formatRelativeTimestamp(caseData.expiresAt),
      inline: true,
    });
  }

  if (caseData.guildId) {
    e.setFooter({ text: `Guild ID: ${caseData.guildId}` });
  }

  return e;
}

export function buildHistoryEmbed(
  target: User,
  cases: Array<{
    caseNumber: number;
    action: string;
    createdAt: Date;
    reason: string | null;
  }>,
  options?: {
    maxCases?: number;
    showStats?: boolean;
  }
): EmbedBuilder {
  const maxCases = options?.maxCases ?? 10;
  const recentCases = cases.slice(0, maxCases);

  const e = embed(COLORS.WARN)
    .setTitle(`Moderation History for ${target.tag}`)
    .setThumbnail(target.displayAvatarURL())
    .setTimestamp();

  if (options?.showStats !== false) {
    const stats = {
      Total: cases.length,
      Bans: cases.filter((c) => c.action === 'BAN' || c.action === 'TEMPBAN').length,
      Kicks: cases.filter((c) => c.action === 'KICK').length,
      Timeouts: cases.filter((c) => c.action === 'TIMEOUT').length,
      Warns: cases.filter((c) => c.action === 'WARN').length,
    };

    e.setDescription(
      Object.entries(stats)
        .map(([k, v]) => `**${k}:** ${v}`)
        .join('\n')
    );
  }

  if (recentCases.length > 0) {
    const caseList = recentCases
      .map((c) => {
        const timestamp = formatRelativeTimestamp(c.createdAt);
        const reasonPreview = c.reason ? truncateText(c.reason, 50) : 'No reason';
        return `**Case #${c.caseNumber}** - ${c.action}\n${timestamp} · ${reasonPreview}`;
      })
      .join('\n\n');

    e.addFields({
      name: `Recent Cases (${recentCases.length} of ${cases.length})`,
      value: caseList || 'No cases',
    });
  }

  if (cases.length > maxCases) {
    e.setFooter({
      text: `Showing ${maxCases} of ${cases.length} cases. Use /mod case <number> to view specific cases.`,
    });
  }

  return e;
}

export function buildUserNotificationEmbed(
  action: string,
  guild: { name: string; iconURL(): string | null },
  reason: string,
  options?: {
    duration?: number;
  }
): EmbedBuilder {
  const color = MOD_ACTION_COLORS[action] ?? COLORS.INFO;

  const e = embed(color)
    .setTitle(`You have been ${action.toLowerCase()}`)
    .addFields(
      { name: 'Server', value: guild.name },
      { name: 'Reason', value: reason || 'No reason provided' }
    )
    .setThumbnail(guild.iconURL())
    .setTimestamp();

  if (options?.duration) {
    e.addFields({ name: 'Duration', value: formatDuration(options.duration) });
  }

  return e;
}

export function buildSetupEmbed(
  title: string,
  settings: Record<string, string>,
  steps?: string[],
  options?: {
    color?: ColorResolvable;
    footer?: string;
  }
): EmbedBuilder {
  const e = embed(options?.color ?? COLORS.PRIMARY).setTitle(title);

  const settingsValue = Object.entries(settings)
    .map(([key, value]) => `**${key}:** ${value}`)
    .join('\n');

  e.addFields({ name: 'Current Settings', value: settingsValue });

  if (steps && steps.length > 0) {
    e.addFields({
      name: 'Configuration Steps',
      value: steps.map((s, i) => `**${i + 1}.** ${s}`).join('\n'),
    });
  }

  if (options?.footer) {
    e.setFooter({ text: options.footer });
  }

  return e;
}

export function buildCompletionEmbed(
  title: string,
  description?: string,
  options?: {
    color?: ColorResolvable;
  }
): EmbedBuilder {
  return embed(options?.color ?? COLORS.SUCCESS)
    .setTitle(`${EMOJI.STATUS.SUCCESS} ${title}`)
    .setDescription(description ?? 'Configuration complete.')
    .setTimestamp();
}

export function buildTimeoutEmbed(
  title: string,
  description?: string,
  options?: {
    color?: ColorResolvable;
  }
): EmbedBuilder {
  return embed(options?.color ?? COLORS.WARNING)
    .setTitle(title)
    .setDescription(description ?? 'This action has timed out.')
    .setTimestamp();
}
