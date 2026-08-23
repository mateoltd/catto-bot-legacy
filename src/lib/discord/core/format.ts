/**
 * Text Formatting Utilities
 *
 * Low-level formatting helpers for Discord messages.
 */

import type { User } from 'discord.js';

/**
 * Format key-value pairs into a stats line
 * @param stats - Key-value pairs to format
 * @param mode - 'inline' (default): "Key1: val1 · Key2: val2", 'columns': side-by-side columns
 */
export function formatStatsLine(
  stats: Record<string, string | number>,
  mode: 'inline' | 'columns' = 'inline'
): string {
  const entries = Object.entries(stats);

  if (mode === 'inline') {
    return entries.map(([key, value]) => `**${key}:** ${value}`).join(' · ');
  }

  // Columns mode: split entries into two columns displayed side by side
  const midpoint = Math.ceil(entries.length / 2);
  const leftColumn = entries.slice(0, midpoint);
  const rightColumn = entries.slice(midpoint);

  const rows: string[] = [];
  for (let i = 0; i < leftColumn.length; i++) {
    const leftEntry = leftColumn[i];
    const rightEntry = rightColumn[i];

    if (!leftEntry) continue;

    const left = `**${leftEntry[0]}:** ${leftEntry[1]}`;
    const right = rightEntry ? `**${rightEntry[0]}:** ${rightEntry[1]}` : '';
    rows.push(right ? `${left} · ${right}` : left);
  }

  return rows.join('\n');
}

/**
 * Escape underscores in a username/tag to prevent italic formatting.
 * Discord usernames only allow [a-z0-9_.], so `_` is the only markdown character.
 */
export function safeTag(tag: string): string {
  return tag.replace(/_/g, '\\_');
}

/**
 * Format a user with tag and ID
 */
export function formatUserMention(user: User | string): string {
  if (typeof user === 'string') {
    return `<@${user}>`;
  }

  return `${safeTag(user.tag)} (\`${user.id}\`)`;
}

/**
 * Format a relative timestamp (<t:unix:R>)
 */
export function formatRelativeTimestamp(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

/**
 * Format an absolute timestamp (<t:unix:F>)
 */
export function formatAbsoluteTimestamp(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format pagination info
 */
export function formatPaginationInfo(current: number, total: number, itemCount: number): string {
  return `Page ${current} of ${total} (${itemCount} total)`;
}

/**
 * Format duration in seconds to human-readable: "1d 2h 3m 4s"
 */
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ') || '0s';
}

/**
 * Format duration in compact form: "1h" instead of "1h 0m 0s"
 */
export function formatDurationShort(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/**
 * Create a Discord timestamp string
 */
export function timestamp(
  date: Date | number,
  style: 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R' = 'f'
): string {
  const unix = typeof date === 'number' ? date : Math.floor(date.getTime() / 1000);
  return `<t:${unix}:${style}>`;
}

/**
 * Create a user mention
 */
export function userMention(userId: string): string {
  return `<@${userId}>`;
}

/**
 * Create a channel mention
 */
export function channelMention(channelId: string): string {
  return `<#${channelId}>`;
}

/**
 * Create a role mention
 */
export function roleMention(roleId: string): string {
  return `<@&${roleId}>`;
}
