/**
 * Moderation Action Execution
 *
 * Shared execution logic for moderation actions with consistent
 * logging and response building.
 */

import type { Guild, User } from 'discord.js';
import { ModAction } from '@prisma/client';
import { moderationService } from '../services/ModerationService.js';
import { muteService } from '../services/MuteService.js';
import { checkAndSetDedup, storePendingOverride } from '../services/DedupService.js';
import { notifyUser, logModAction } from '../discord/embeds/presets.js';
import type { ModerationContext } from './context.js';
import type { ModActionResult, MuteResult, DedupInfo, UserId } from '../domain/types.js';
import { asGuildId, asUserId, asDuration } from '../domain/types.js';

// ─── Dedup Helper ───

/**
 * Run the dedup check for a moderation action.
 * Returns a blocked ModActionResult if duplicate detected, or null to proceed.
 */
async function dedupGuard(
  context: ModerationContext,
  action: ModAction,
  extra?: Record<string, unknown>
): Promise<ModActionResult | null> {
  if (context.skipDedup) return null;

  const result = await checkAndSetDedup(
    context.guild.id,
    context.target.id,
    action,
    context.moderator.id,
    context.moderator.tag,
    context.reason
  );

  if (!result.isDuplicate || !result.existing) return null;

  // Store pending override so the confirm button can replay the action
  const pendingId = await storePendingOverride({
    guildId: context.guild.id,
    targetId: context.target.id,
    action,
    reason: context.reason,
    duration: context.duration,
    moderatorId: context.moderator.id,
    extra,
  });

  const dedupInfo: DedupInfo = {
    moderatorId: result.existing.moderatorId,
    moderatorTag: result.existing.moderatorTag,
    timestamp: result.existing.timestamp,
    pendingId,
  };

  return {
    success: false,
    error: `This user was already actioned by ${result.existing.moderatorTag} less than 2 minutes ago.`,
    userNotified: false,
    deduplicated: dedupInfo,
  };
}

// Core Action Executors

/**
 * Execute a warn action
 */
export async function executeWarn(context: ModerationContext): Promise<ModActionResult> {
  // Dedup check
  const blocked = await dedupGuard(context, ModAction.WARN);
  if (blocked) return blocked;

  // Notify user before warning
  await notifyUser(context.target, ModAction.WARN, context.guild, context.reason);

  // Execute via service
  const result = await moderationService.warn(
    context.guild,
    context.target,
    context.moderator,
    context.reason
  );

  // Log to mod channel on success
  if (result.success && result.caseNumber) {
    await logModAction(
      context.guild,
      ModAction.WARN,
      context.target,
      context.moderator,
      context.reason,
      result.caseNumber
    );
  }

  return result;
}

/**
 * Execute a kick action
 */
export async function executeKick(context: ModerationContext): Promise<ModActionResult> {
  if (!context.targetMember) {
    return { success: false, error: 'User is not in this server.', userNotified: false };
  }

  // Dedup check
  const blockedKick = await dedupGuard(context, ModAction.KICK);
  if (blockedKick) return blockedKick;

  // Notify user before kick
  await notifyUser(context.target, ModAction.KICK, context.guild, context.reason);

  // Execute via service
  const result = await moderationService.kick(
    context.guild,
    context.targetMember,
    context.moderator,
    context.reason
  );

  // Log to mod channel on success
  if (result.success && result.caseNumber) {
    await logModAction(
      context.guild,
      ModAction.KICK,
      context.target,
      context.moderator,
      context.reason,
      result.caseNumber
    );
  }

  return result;
}

/**
 * Execute a ban action
 */
export async function executeBan(
  context: ModerationContext,
  deleteMessages: boolean = false
): Promise<ModActionResult> {
  // Dedup check
  const blockedBan = await dedupGuard(context, ModAction.BAN, { deleteMessages });
  if (blockedBan) return blockedBan;

  // Notify user before ban (only if in server)
  if (context.targetMember) {
    await notifyUser(context.target, ModAction.BAN, context.guild, context.reason);
  }

  // Execute via service
  const result = await moderationService.ban(
    context.guild,
    context.target,
    context.moderator,
    context.reason,
    deleteMessages
  );

  // Log to mod channel on success
  if (result.success && result.caseNumber) {
    await logModAction(
      context.guild,
      ModAction.BAN,
      context.target,
      context.moderator,
      context.reason,
      result.caseNumber
    );
  }

  return result;
}

/**
 * Execute a softban action (ban + immediate unban to delete messages)
 */
export async function executeSoftban(context: ModerationContext): Promise<ModActionResult> {
  // Dedup check
  const blockedSoftban = await dedupGuard(context, ModAction.SOFTBAN);
  if (blockedSoftban) return blockedSoftban;

  // Notify user before softban (only if in server)
  if (context.targetMember) {
    await notifyUser(context.target, ModAction.SOFTBAN, context.guild, context.reason);
  }

  // Execute via service
  const result = await moderationService.softban(
    context.guild,
    context.target,
    context.moderator,
    context.reason
  );

  // Log to mod channel on success
  if (result.success && result.caseNumber) {
    await logModAction(
      context.guild,
      ModAction.SOFTBAN,
      context.target,
      context.moderator,
      context.reason,
      result.caseNumber
    );
  }

  return result;
}

/**
 * Execute a timeout action
 */
export async function executeTimeout(context: ModerationContext): Promise<ModActionResult> {
  if (!context.targetMember) {
    return { success: false, error: 'User is not in this server.', userNotified: false };
  }

  if (!context.duration) {
    return { success: false, error: 'Duration is required for timeout.', userNotified: false };
  }

  // Dedup check
  const blockedTimeout = await dedupGuard(context, ModAction.TIMEOUT);
  if (blockedTimeout) return blockedTimeout;

  // Notify user before timeout
  await notifyUser(
    context.target,
    ModAction.TIMEOUT,
    context.guild,
    context.reason,
    context.duration
  );

  // Execute via service
  const result = await moderationService.timeout(
    context.guild,
    context.targetMember,
    context.moderator,
    context.reason,
    context.duration
  );

  // Log to mod channel on success
  if (result.success && result.caseNumber) {
    await logModAction(
      context.guild,
      ModAction.TIMEOUT,
      context.target,
      context.moderator,
      context.reason,
      result.caseNumber,
      context.duration
    );
  }

  return result;
}

/**
 * Execute a tempban action
 */
export async function executeTempban(
  context: ModerationContext,
  deleteMessages: boolean = false
): Promise<ModActionResult> {
  if (!context.duration) {
    return { success: false, error: 'Duration is required for tempban.', userNotified: false };
  }

  // Dedup check
  const blockedTempban = await dedupGuard(context, ModAction.TEMPBAN, { deleteMessages });
  if (blockedTempban) return blockedTempban;

  // Notify user before tempban (only if in server)
  if (context.targetMember) {
    await notifyUser(
      context.target,
      ModAction.TEMPBAN,
      context.guild,
      context.reason,
      context.duration
    );
  }

  // Execute via service
  const result = await moderationService.tempban(
    context.guild,
    context.target,
    context.moderator,
    context.reason,
    context.duration,
    deleteMessages
  );

  // Log to mod channel on success
  if (result.success && result.caseNumber) {
    await logModAction(
      context.guild,
      ModAction.TEMPBAN,
      context.target,
      context.moderator,
      context.reason,
      result.caseNumber,
      context.duration
    );
  }

  return result;
}

/**
 * Execute an unban action
 */
export async function executeUnban(
  guild: Guild,
  userId: UserId,
  userTag: string,
  moderator: User,
  reason: string
): Promise<ModActionResult> {
  // Execute via service
  const result = await moderationService.unban(guild, userId, userTag, moderator, reason);

  // Log to mod channel on success
  if (result.success && result.caseNumber) {
    // We need to fetch the user for the modlog - use ID if fetch fails
    const target = await guild.client.users.fetch(userId).catch(() => null);
    await logModAction(
      guild,
      ModAction.UNBAN,
      target ?? { id: userId, tag: userTag },
      moderator,
      reason,
      result.caseNumber
    );
  }

  return result;
}

// Mute Action Executors

/**
 * Mute type for execution
 */
export type MuteType = 'text' | 'voice' | 'both';

/**
 * Execute a mute action
 */
export async function executeMute(
  context: ModerationContext,
  muteType: MuteType
): Promise<MuteResult> {
  if (!context.targetMember) {
    return { success: false, error: 'User is not in this server.' };
  }

  // Dedup check — map mute type to the corresponding ModAction
  const muteActionMap: Record<MuteType, ModAction> = {
    text: ModAction.MUTE_TEXT,
    voice: ModAction.MUTE_VOICE,
    both: ModAction.MUTE_BOTH,
  };
  const blocked = await dedupGuard(context, muteActionMap[muteType], { muteType });
  if (blocked) {
    return {
      success: false,
      error: blocked.error,
      deduplicated: blocked.deduplicated,
    };
  }

  const muteInput = {
    guildId: asGuildId(context.guild.id),
    userId: asUserId(context.target.id),
    createdById: asUserId(context.moderator.id),
    reason: context.reason,
    duration: context.duration ? asDuration(context.duration) : undefined,
  };

  let result: MuteResult;
  let modAction: ModAction;

  switch (muteType) {
    case 'text':
      modAction = ModAction.MUTE_TEXT;
      result = await muteService.muteText(
        context.guild,
        context.targetMember,
        asUserId(context.moderator.id),
        context.moderator.tag,
        muteInput
      );
      break;
    case 'voice':
      modAction = ModAction.MUTE_VOICE;
      result = await muteService.muteVoice(
        context.guild,
        context.targetMember,
        asUserId(context.moderator.id),
        context.moderator.tag,
        muteInput
      );
      break;
    case 'both':
      modAction = ModAction.MUTE_BOTH;
      result = await muteService.muteBoth(
        context.guild,
        context.targetMember,
        asUserId(context.moderator.id),
        context.moderator.tag,
        muteInput
      );
      break;
  }

  // Log to mod channel on success
  if (result.success && result.caseNumber) {
    await logModAction(
      context.guild,
      modAction,
      context.target,
      context.moderator,
      context.reason,
      result.caseNumber,
      context.duration
    );
  }

  return result;
}

/**
 * Execute an unmute action
 */
export async function executeUnmute(
  context: ModerationContext,
  muteType: MuteType
): Promise<MuteResult> {
  if (!context.targetMember) {
    return { success: false, error: 'User is not in this server.' };
  }

  const unmuteInput = {
    guildId: asGuildId(context.guild.id),
    userId: asUserId(context.target.id),
    moderatorId: asUserId(context.moderator.id),
    moderatorTag: context.moderator.tag,
    reason: context.reason,
  };

  let result: MuteResult;
  let modAction: ModAction;

  switch (muteType) {
    case 'text':
      modAction = ModAction.UNMUTE_TEXT;
      result = await muteService.unmuteText(context.guild, context.targetMember, unmuteInput);
      break;
    case 'voice':
      modAction = ModAction.UNMUTE_VOICE;
      result = await muteService.unmuteVoice(context.guild, context.targetMember, unmuteInput);
      break;
    case 'both':
      modAction = ModAction.UNMUTE_BOTH;
      result = await muteService.unmuteBoth(context.guild, context.targetMember, unmuteInput);
      break;
  }

  // Log to mod channel on success
  if (result.success && result.caseNumber) {
    await logModAction(
      context.guild,
      modAction,
      context.target,
      context.moderator,
      context.reason,
      result.caseNumber
    );
  }

  return result;
}
