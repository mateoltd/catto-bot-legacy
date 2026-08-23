import { ModAction } from '@prisma/client';
import type { User } from 'discord.js';
import { moderationService } from '../../modules/moderation/services/ModerationService.js';
import { logModAction, notifyUser } from '../../modules/moderation/discord/embeds/presets.js';
import {
  buildModActionSuccess,
  buildModActionError,
} from '../../modules/moderation/discord/panelBuilder.js';
import { commandDedupCheck } from '../../modules/moderation/handlers/dedupCheck.js';
import type { BanOptions } from '#lib/interaction/typedOptions.js';
import { errorMessage } from '#lib/discord/index.js';
import type { CommandResponder } from '#lib/discord/index.js';
import { ensureNonNull } from '#root/lib/utils.js';
import { Gate, isFail } from '#lib/validation/Gate.js';

export async function handleBan(options: BanOptions, ctx: CommandResponder) {
  await ctx.defer();

  // Get Gate for hierarchy validation
  const gate = Gate.fromMember(ctx.member, ctx.guild);

  try {
    // Check bot permissions
    if (!options.guild.members.me?.permissions.has('BanMembers')) {
      await ctx.editReply(errorMessage('Error', 'I do not have permission to ban members.'));
      return;
    }

    // Try to fetch the target user if we don't have it
    let targetUser: User | undefined = options.target;
    if (!targetUser) {
      try {
        targetUser = await ctx.client.users.fetch(options.targetId);
      } catch {
        // User doesn't exist or is not fetchable - we can still ban by ID
      }
    }

    // Try to fetch target member (if they're in the server)
    let targetMember;
    let notified = false;
    try {
      targetMember = await options.guild.members.fetch(options.targetId);

      // Check hierarchy using Gate (only if target is a member)
      const hierarchyResult = gate.checkHierarchy(targetMember);
      if (isFail(hierarchyResult)) {
        await ctx.editReply(hierarchyResult.response);
        return;
      }

      // Notify user before ban (only if target is a member and we have the user object)
      if (targetUser) {
        notified = await notifyUser(targetUser, ModAction.BAN, options.guild, options.reason);
      }
    } catch {
      // User is not in the server - that's fine, we can still ban them by ID
      // No hierarchy check needed, no DM can be sent
    }

    // Dedup check
    const dedupWarning = await commandDedupCheck({
      guild: options.guild,
      target: targetUser ?? { id: options.targetId, tag: `Unknown (${options.targetId})` },
      moderator: options.moderator,
      action: ModAction.BAN,
      reason: options.reason ?? 'No reason provided',
      extra: { deleteMessages: options.deleteMessages },
    });
    if (dedupWarning) {
      await ctx.editReply(dedupWarning);
      return;
    }

    // Execute ban via service
    // The service should accept either a User object or just the ID
    const result = await moderationService.banById(
      options.guild,
      options.targetId,
      targetUser?.tag ?? `Unknown (${options.targetId})`,
      options.moderator,
      options.reason,
      options.deleteMessages
    );

    if (!result.success) {
      await ctx.editReply(
        buildModActionError(
          result.error ?? 'Failed to ban the user.',
          'Check bot permissions and role hierarchy.'
        )
      );
      return;
    }

    // Log to mod channel
    await logModAction(
      options.guild,
      ModAction.BAN,
      targetUser ?? { id: options.targetId, tag: `Unknown User (${options.targetId})` },
      options.moderator,
      options.reason ?? 'No reason provided',
      ensureNonNull(result.caseNumber, 'logModAction(102): result.caseNumber')
    );

    // Build success response
    const successTarget = targetUser ?? {
      id: options.targetId,
      tag: `Unknown User (${options.targetId})`,
    };

    await ctx.editReply(
      buildModActionSuccess(
        'Ban',
        successTarget as User,
        ensureNonNull(result.caseNumber, 'buildModActionSuccess(117): result.caseNumber'),
        options.reason ?? 'No reason provided',
        undefined,
        // Only report DM sent if we actually attempted it (target in guild) and it succeeded
        { dmSent: Boolean(targetMember && notified), guildId: options.guild.id }
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in ban command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An unexpected error occurred while processing the ban.'))
      .catch(() => {});
  }
}
