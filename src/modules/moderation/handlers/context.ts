/**
 * Moderation Handler Context
 *
 * Provides shared context types and builders for moderation actions.
 */

import type { Guild, GuildMember, User } from 'discord.js';
import type { GuildId, UserId, DurationSeconds } from '../domain/types.js';

/**
 * Context for a moderation action
 */
export interface ModerationContext {
  /** The guild where the action is taking place */
  guild: Guild;
  /** The user being moderated */
  target: User;
  /** The guild member being moderated (if in server) */
  targetMember: GuildMember | null;
  /** The moderator performing the action */
  moderator: User;
  /** The moderator as a guild member */
  moderatorMember: GuildMember;
  /** The reason for the action */
  reason: string;
  /** Optional duration for timed actions (in seconds) */
  duration?: DurationSeconds;
  /** When true, skip the mod action dedup check (used for confirmed overrides) */
  skipDedup?: boolean;
}

/**
 * Input for building a moderation context
 */
export interface ModerationContextInput {
  guild: Guild;
  targetId: string;
  moderator: User;
  moderatorMember: GuildMember;
  reason?: string;
  duration?: DurationSeconds;
}

/**
 * Result of building a moderation context
 */
export type ModerationContextResult =
  | { success: true; context: ModerationContext }
  | { success: false; error: string };

/**
 * Build a moderation context from input
 */
export async function buildModerationContext(
  input: ModerationContextInput
): Promise<ModerationContextResult> {
  const { guild, targetId, moderator, moderatorMember, reason, duration } = input;

  // Fetch target user
  let target: User;
  try {
    target = await guild.client.users.fetch(targetId);
  } catch {
    return { success: false, error: 'User not found.' };
  }

  // Try to fetch target member (may not be in server)
  let targetMember: GuildMember | null = null;
  try {
    targetMember = await guild.members.fetch(targetId);
  } catch {
    // User not in server - this is OK for some actions
  }

  return {
    success: true,
    context: {
      guild,
      target,
      targetMember,
      moderator,
      moderatorMember,
      reason: reason ?? 'No reason provided',
      duration,
    },
  };
}

/**
 * Shorthand IDs from context
 */
export function getContextIds(context: ModerationContext): {
  guildId: GuildId;
  targetId: UserId;
  moderatorId: UserId;
} {
  return {
    guildId: context.guild.id as GuildId,
    targetId: context.target.id as UserId,
    moderatorId: context.moderator.id as UserId,
  };
}
