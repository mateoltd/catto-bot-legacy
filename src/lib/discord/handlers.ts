/**
 * Command Handler Utilities
 *
 * Shared helpers for moderation and other commands to reduce boilerplate.
 * Provides consistent patterns for:
 * - Pre-defer validation with ephemeral errors
 * - Deferred workflow with error handling
 * - Target member fetching
 *
 * For hierarchy validation and authorization, use the Gate system:
 * - Gate.checkHierarchy() for hierarchy validation
 * - Gate.requireAuth() for authorization
 * - Gate.requirePunitive() for combined auth + target + hierarchy validation
 */

import type { ChatInputCommandInteraction, Guild, GuildMember, User } from 'discord.js';
import { ValidationError } from '#lib/validation/zod.js';
import { ephemeralError, defer, editReply, errorMessage } from './index.js';
import type { FluentContainer } from './containers/container.js';

/**
 * Result of a command handler operation
 */
export interface HandlerResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Context passed to command handlers after initial setup
 */
export interface ModerationContext {
  interaction: ChatInputCommandInteraction;
  guild: Guild;
  moderator: User;
  moderatorMember: GuildMember;
}

/**
 * Extended context when a target user is involved
 */
export interface TargetContext extends ModerationContext {
  target: User;
  targetMember: GuildMember | null;
}

/**
 * Options for withErrorHandling wrapper
 */
export interface ErrorHandlerOptions {
  /** Custom error message prefix */
  errorPrefix?: string;
  /** Whether to log the error (default: true) */
  logError?: boolean;
}

/**
 * Parse options with ValidationError handling.
 * Returns the parsed options or sends an ephemeral error and returns null.
 *
 * @example
 * ```ts
 * const options = await parseWithValidation(interaction, () => parseKickOptions(interaction));
 * if (!options) return;
 * ```
 */
export async function parseWithValidation<T>(
  interaction: ChatInputCommandInteraction,
  parser: () => T
): Promise<T | null> {
  try {
    return parser();
  } catch (error) {
    if (error instanceof ValidationError) {
      await interaction.reply(ephemeralError(error.message));
      return null;
    }
    throw error;
  }
}

/**
 * Fetch a guild member by ID, returning null if not found.
 * Useful for checking if a user is in the server.
 */
export async function fetchMemberSafe(guild: Guild, userId: string): Promise<GuildMember | null> {
  try {
    return await guild.members.fetch(userId);
  } catch {
    return null;
  }
}

/**
 * Require the target to be a member of the guild.
 * Sends an error reply if not found.
 *
 * @returns The member if found, or null if not (and error was sent)
 */
export async function requireMember(
  interaction: ChatInputCommandInteraction,
  guild: Guild,
  userId: string,
  errorMsg = 'Target is not a member of this server.'
): Promise<GuildMember | null> {
  const member = await fetchMemberSafe(guild, userId);
  if (!member) {
    await editReply(interaction, errorMessage('Error', errorMsg));
    return null;
  }
  return member;
}

/**
 * Check bot permissions and return error if missing.
 */
export function checkBotPermission(
  guild: Guild,
  permission: bigint,
  errorMsg: string
): FluentContainer | null {
  if (!guild.members.me?.permissions.has(permission)) {
    return errorMessage('Error', errorMsg);
  }
  return null;
}

/**
 * Wrapper for deferred command handlers with consistent error handling.
 *
 * @example
 * ```ts
 * export async function handleKick(interaction: ChatInputCommandInteraction) {
 *   await withDeferredHandler(interaction, async () => {
 *     // Your command logic here
 *     // Throw errors or return error containers
 *   });
 * }
 * ```
 */
export async function withDeferredHandler(
  interaction: ChatInputCommandInteraction,
  handler: () => Promise<void>,
  options: ErrorHandlerOptions = {}
): Promise<void> {
  const { errorPrefix = 'An unexpected error occurred', logError = true } = options;

  await defer(interaction);

  try {
    await handler();
  } catch (error) {
    if (logError) {
      interaction.client.logger.error(`[CommandHandler] ${errorPrefix}:`, error);
    }
    await editReply(interaction, errorMessage('Error', `${errorPrefix}.`)).catch(() => {});
  }
}
