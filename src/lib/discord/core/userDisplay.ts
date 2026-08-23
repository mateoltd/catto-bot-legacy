/**
 * User Display Resolver
 *
 * Utilities for displaying user information consistently,
 * even when the user is not in the guild or cannot be resolved.
 */

import { type Client, type User } from 'discord.js';
import { safeTag } from './format.js';
import { container } from '@sapphire/framework';

export interface UserDisplayOptions {
  includeId?: boolean;
  useMention?: boolean;
}

export interface UserDisplayResult {
  label: string;
  tag: string | null;
  id: string;
  resolved: boolean;
}

/**
 * Get a display label for a user by ID (async - fetches from API)
 */
export async function getUserDisplayLabel(
  client: Client,
  userId: string,
  fallbackTag?: string | null,
  options: UserDisplayOptions = {}
): Promise<UserDisplayResult> {
  const { includeId = true } = options;

  let user: User | null = null;
  try {
    user = await client.users.fetch(userId);
  } catch {
    // User not found
  }

  if (user) {
    const escapedTag = safeTag(user.tag);
    const label = includeId ? `${escapedTag} (\`${userId}\`)` : escapedTag;
    return { label, tag: user.tag, id: userId, resolved: true };
  }

  if (fallbackTag && fallbackTag !== 'Unknown#0000' && !fallbackTag.startsWith('Unknown#')) {
    const safeFallback = safeTag(fallbackTag);
    const label = includeId ? `${safeFallback} (\`${userId}\`)` : safeFallback;
    return { label, tag: fallbackTag, id: userId, resolved: false };
  }

  return { label: `\`${userId}\``, tag: null, id: userId, resolved: false };
}

/**
 * Get a display label synchronously (uses cache only)
 */
export function getUserDisplayLabelSync(
  client: Client,
  userId: string,
  fallbackTag?: string | null,
  options: UserDisplayOptions = {}
): UserDisplayResult {
  const { includeId = true } = options;
  const user = client.users.cache.get(userId);

  if (user) {
    const escapedTag = safeTag(user.tag);
    const label = includeId ? `${escapedTag} (\`${userId}\`)` : escapedTag;
    return { label, tag: user.tag, id: userId, resolved: true };
  }

  if (fallbackTag && fallbackTag !== 'Unknown#0000' && !fallbackTag.startsWith('Unknown#')) {
    const safeFallback = safeTag(fallbackTag);
    const label = includeId ? `${safeFallback} (\`${userId}\`)` : safeFallback;
    return { label, tag: fallbackTag, id: userId, resolved: false };
  }

  return { label: `\`${userId}\``, tag: null, id: userId, resolved: false };
}

/**
 * Get a safe tag for a user (never returns "Unknown#0000")
 */
export async function getSafeUserTag(userId: string, existingTag?: string | null): Promise<string> {
  try {
    const user = await container.client.users.fetch(userId);
    return user.tag;
  } catch {
    if (existingTag && existingTag !== 'Unknown#0000' && !existingTag.startsWith('Unknown#')) {
      return existingTag;
    }
    return `User ${userId}`;
  }
}

/**
 * Check if a tag is a placeholder value
 */
export function isPlaceholderTag(tag: string | null | undefined): boolean {
  if (!tag) return true;
  return tag === 'Unknown#0000' || tag.startsWith('Unknown#') || tag === 'System';
}

/**
 * Format user for mod log (no pings, clean format)
 */
export function formatUserForLog(userId: string, tag?: string | null): string {
  if (tag && !isPlaceholderTag(tag)) {
    return `${safeTag(tag)} (\`${userId}\`)`;
  }
  return `\`${userId}\``;
}
