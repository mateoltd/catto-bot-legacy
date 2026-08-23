/**
 * Embed Presets - Quick embed builders
 */

import { EmbedBuilder, type User, type ColorResolvable, type APIEmbedField } from 'discord.js';
import { COLORS, EMOJI } from '../design/index.js';
import { formatRelativeTimestamp } from '../core/format.js';

/**
 * Create a basic embed with optional color
 */
export function embed(color?: ColorResolvable): EmbedBuilder {
  const e = new EmbedBuilder();
  if (color) e.setColor(color);
  return e;
}

export function successEmbed(): EmbedBuilder {
  return embed(COLORS.SUCCESS);
}

export function errorEmbed(): EmbedBuilder {
  return embed(COLORS.ERROR);
}

export function warningEmbed(): EmbedBuilder {
  return embed(COLORS.WARNING);
}

export function infoEmbed(): EmbedBuilder {
  return embed(COLORS.INFO);
}

export function neutralEmbed(): EmbedBuilder {
  return embed(COLORS.NEUTRAL);
}

// Quick builders with title and description
export function buildSuccessEmbed(
  description: string,
  options?: { title?: string; footer?: string }
): EmbedBuilder {
  const e = successEmbed()
    .setTitle(`${EMOJI.STATUS.SUCCESS} ${options?.title ?? 'Success'}`)
    .setDescription(description)
    .setTimestamp();
  if (options?.footer) e.setFooter({ text: options.footer });
  return e;
}

export function buildErrorEmbed(
  description: string,
  options?: { title?: string; suggestion?: string; footer?: string }
): EmbedBuilder {
  const e = errorEmbed()
    .setTitle(`${EMOJI.STATUS.ERROR} ${options?.title ?? 'Error'}`)
    .setDescription(description)
    .setTimestamp();
  if (options?.suggestion) e.addFields({ name: 'Suggestion', value: options.suggestion });
  if (options?.footer) e.setFooter({ text: options.footer });
  return e;
}

export function buildWarningEmbed(
  description: string,
  options?: { title?: string; footer?: string }
): EmbedBuilder {
  const e = warningEmbed()
    .setTitle(`${EMOJI.STATUS.WARNING} ${options?.title ?? 'Warning'}`)
    .setDescription(description)
    .setTimestamp();
  if (options?.footer) e.setFooter({ text: options.footer });
  return e;
}

export function buildInfoEmbed(
  description: string,
  options?: { title?: string; footer?: string }
): EmbedBuilder {
  const e = infoEmbed()
    .setTitle(`${EMOJI.STATUS.INFO} ${options?.title ?? 'Information'}`)
    .setDescription(description)
    .setTimestamp();
  if (options?.footer) e.setFooter({ text: options.footer });
  return e;
}

export function buildStatsEmbed(
  title: string,
  sections: Array<{ name: string; stats: Record<string, string | number>; inline?: boolean }>,
  options?: { color?: ColorResolvable; thumbnail?: string; footer?: string }
): EmbedBuilder {
  const e = embed(options?.color ?? COLORS.INFO)
    .setTitle(title)
    .setTimestamp();
  if (options?.thumbnail) e.setThumbnail(options.thumbnail);

  for (const section of sections) {
    const value = Object.entries(section.stats)
      .map(([key, val]) => `**${key}:** ${val}`)
      .join('\n');
    e.addFields({ name: section.name, value, inline: section.inline ?? true });
  }

  if (options?.footer) e.setFooter({ text: options.footer });
  return e;
}

export function buildListEmbed(
  title: string,
  items: string[],
  options?: {
    description?: string;
    color?: ColorResolvable;
    emptyMessage?: string;
    page?: number;
    totalPages?: number;
    totalItems?: number;
    thumbnail?: string;
  }
): EmbedBuilder {
  const e = embed(options?.color ?? COLORS.INFO)
    .setTitle(title)
    .setTimestamp();
  if (options?.description) e.setDescription(options.description);
  if (options?.thumbnail) e.setThumbnail(options.thumbnail);

  if (items.length === 0) {
    e.addFields({ name: '\u200b', value: options?.emptyMessage ?? '*No items to display*' });
  } else {
    e.addFields({ name: '\u200b', value: items.join('\n') });
  }

  if (options?.page !== undefined && options?.totalPages !== undefined) {
    const itemsText = options.totalItems ? ` (${options.totalItems} total)` : '';
    e.setFooter({ text: `Page ${options.page} of ${options.totalPages}${itemsText}` });
  }

  return e;
}

export function buildUserEmbed(
  user: User,
  options?: {
    title?: string;
    color?: ColorResolvable;
    fields?: APIEmbedField[];
    showId?: boolean;
    showCreatedAt?: boolean;
  }
): EmbedBuilder {
  const e = embed(options?.color ?? COLORS.INFO)
    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();

  if (options?.title) e.setTitle(options.title);
  if (options?.showId !== false)
    e.addFields({ name: 'User ID', value: `\`${user.id}\``, inline: true });
  if (options?.showCreatedAt !== false) {
    e.addFields({
      name: 'Account Created',
      value: formatRelativeTimestamp(user.createdAt),
      inline: true,
    });
  }
  if (options?.fields) e.addFields(options.fields);

  return e;
}
