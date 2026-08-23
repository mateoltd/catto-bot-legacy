/**
 * Shared utilities for creative ban commands
 *
 * Provides common helpers: target resolution, ban execution via moderationService,
 * permission checking, and cleanup utilities.
 */

import { container } from '@sapphire/framework';
import {
  type Guild,
  type GuildMember,
  type Message,
  type User,
  type TextChannel,
  PermissionFlagsBits,
} from 'discord.js';
import { moderationService } from '../../../modules/moderation/services/ModerationService.js';
import { logModAction } from '../../../modules/moderation/discord/embeds/presets.js';
import {
  ModAction,
  type UserId,
  type CaseNumber,
} from '../../../modules/moderation/domain/types.js';
import { isFeatureEnabled } from '#lib/features/featureFlags.js';
import { checkCommandAccess } from '#lib/validation/permissionResolver.js';

/**
 * Result from executing a creative ban.
 */
export interface CreativeBanResult {
  success: boolean;
  caseNumber?: CaseNumber;
  error?: string;
}

/**
 * Check if creative bans feature is enabled for a guild.
 */
export function isCreativeBansEnabled(guildId: string): boolean {
  return isFeatureEnabled('creative-bans', guildId);
}

/**
 * Parse a target user mention or ID from message arguments.
 * Supports: <@!id>, <@id>, raw ID
 */
export function parseTargetId(args: string): string | null {
  const mentionMatch = args.match(/<@!?(\d{17,20})>/);
  if (mentionMatch?.[1]) return mentionMatch[1];

  const idMatch = args.match(/^(\d{17,20})/);
  if (idMatch?.[1]) return idMatch[1];

  return null;
}

/**
 * Resolve a target member from a message, sending an error if not found.
 */
export async function resolveTarget(message: Message, args: string): Promise<GuildMember | null> {
  if (!message.guild || !message.channel.isSendable()) return null;

  const targetId = parseTargetId(args.trim());
  if (!targetId) {
    await message.channel.send('❌ Debes mencionar a un usuario o proporcionar su ID.');
    return null;
  }

  try {
    return await message.guild.members.fetch(targetId);
  } catch {
    await message.channel.send('❌ No se encontró al usuario en este servidor.');
    return null;
  }
}

/**
 * Check if the invoking member has permission to use a creative ban command.
 * Uses the Gate permission system with fallback to Administrator check.
 */
export async function checkCreativePermission(
  member: GuildMember,
  commandKey: string
): Promise<boolean> {
  const result = await checkCommandAccess(member, commandKey);
  return result.allowed;
}

/**
 * Check basic bot permissions needed for banning.
 */
export function checkBotBanPermission(guild: Guild): boolean {
  return guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers) ?? false;
}

/**
 * Check role hierarchy: can the moderator moderate this target?
 */
export function canModerateTarget(moderator: GuildMember, target: GuildMember): string | null {
  if (moderator.id === target.id) {
    return 'No puedes usar esto en ti mismo.';
  }
  if (target.id === target.guild.ownerId) {
    return 'No puedes usar esto en el dueño del servidor.';
  }
  if (target.roles.highest.position >= moderator.roles.highest.position) {
    return 'El objetivo tiene un rol igual o superior al tuyo.';
  }
  const botMember = target.guild.members.me;
  if (botMember && target.roles.highest.position >= botMember.roles.highest.position) {
    return 'El objetivo tiene un rol igual o superior al mío.';
  }
  return null;
}

/**
 * Execute the actual ban via ModerationService, create the case, and log it.
 */
export async function executeCreativeBan(
  guild: Guild,
  target: User,
  moderator: User,
  reason: string,
  creativeName: string
): Promise<CreativeBanResult> {
  const fullReason = `Creative ban: ${creativeName} — ${reason}`;

  try {
    const result = await moderationService.banById(
      guild,
      target.id as UserId,
      target.tag,
      moderator,
      fullReason,
      false
    );

    if (!result.success) {
      return { success: false, error: result.error ?? 'Error al banear al usuario.' };
    }

    // Log to mod channel
    if (result.caseNumber) {
      await logModAction(guild, ModAction.BAN, target, moderator, fullReason, result.caseNumber);
    }

    return { success: true, caseNumber: result.caseNumber };
  } catch (error) {
    container.logger.error(`[creative-bans/${creativeName}] Ban execution failed:`, error);
    return { success: false, error: 'Error inesperado al banear al usuario.' };
  }
}

/**
 * Safe delay helper.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely delete a channel, ignoring errors (e.g., already deleted).
 */
export async function safeDeleteChannel(channel: TextChannel): Promise<void> {
  try {
    await channel.delete();
  } catch {
    // Channel may already be deleted or inaccessible
  }
}

/**
 * Generate zalgo-style distorted text.
 */
export function zalgoify(text: string, intensity: number = 3): string {
  const zalgoUp = [
    '\u0300',
    '\u0301',
    '\u0302',
    '\u0303',
    '\u0304',
    '\u0305',
    '\u0306',
    '\u0307',
    '\u0308',
    '\u0309',
    '\u030a',
    '\u030b',
    '\u030c',
    '\u030d',
    '\u030e',
    '\u030f',
  ];
  const zalgoDown = [
    '\u0316',
    '\u0317',
    '\u0318',
    '\u0319',
    '\u031a',
    '\u031b',
    '\u031c',
    '\u031d',
    '\u031e',
    '\u031f',
    '\u0320',
    '\u0321',
    '\u0322',
    '\u0323',
    '\u0324',
    '\u0325',
  ];
  const zalgoMid = [
    '\u0315',
    '\u031b',
    '\u0340',
    '\u0341',
    '\u0358',
    '\u0321',
    '\u0322',
    '\u0327',
    '\u0328',
    '\u0334',
    '\u0335',
    '\u0336',
    '\u0337',
    '\u0338',
  ];

  return text
    .split('')
    .map((char) => {
      let result = char;
      for (let i = 0; i < intensity; i++) {
        result += zalgoUp[Math.floor(Math.random() * zalgoUp.length)] ?? '';
        result += zalgoDown[Math.floor(Math.random() * zalgoDown.length)] ?? '';
        if (Math.random() > 0.5) {
          result += zalgoMid[Math.floor(Math.random() * zalgoMid.length)] ?? '';
        }
      }
      return result;
    })
    .join('');
}

/**
 * Generate a random alphanumeric string for captcha.
 */
export function generateCaptchaCode(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)] ?? 'X';
  }
  return result;
}
