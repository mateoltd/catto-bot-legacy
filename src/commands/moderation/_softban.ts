import { ModAction } from '@prisma/client';
import type { GuildMember } from 'discord.js';
import { moderationService } from '../../modules/moderation/services/ModerationService.js';
import { logModAction, notifyUser } from '../../modules/moderation/discord/embeds/presets.js';
import {
  buildModActionSuccess,
  buildModActionError,
} from '../../modules/moderation/discord/panelBuilder.js';
import { commandDedupCheck } from '../../modules/moderation/handlers/dedupCheck.js';
import type { SoftbanOptions } from '#lib/interaction/typedOptions.js';
import { errorMessage } from '#lib/discord/index.js';
import type { CommandResponder } from '#lib/discord/index.js';
import { ensureNonNull } from '#root/lib/utils.js';
import { Gate, isFail } from '#lib/validation/Gate.js';

export async function handleSoftban(options: SoftbanOptions, ctx: CommandResponder) {
  const { target, targetId, reason, deleteDays, guild, moderator } = options;

  // Create gate for validation
  const gate = Gate.fromMember(ctx.member, ctx.guild);

  // Check bot permissions
  if (!guild.members.me?.permissions.has('BanMembers')) {
    await ctx.replyError('I do not have permission to ban members.');
    return;
  }

  // Try to fetch the target member if they're in the server
  let targetMember: GuildMember | null = null;
  try {
    targetMember = await guild.members.fetch(targetId);
  } catch {
    // User is not in the server - that's fine for softban
  }

  // Check hierarchy using Gate (only if target is in server)
  if (targetMember) {
    const hierarchyResult = gate.checkHierarchy(targetMember);
    if (isFail(hierarchyResult)) {
      await gate.deny(hierarchyResult, ctx);
      return;
    }

    // Notify user before softban (only if they're in server)
    if (target) {
      await notifyUser(target, ModAction.SOFTBAN, guild, reason);
    }
  }

  await ctx.defer();

  try {
    // Determine the target tag to display
    const targetTag = target?.tag ?? `User ID: ${targetId}`;

    // Dedup check
    const dedupWarning = await commandDedupCheck({
      guild,
      target: target ?? { id: targetId, tag: targetTag },
      moderator,
      action: ModAction.SOFTBAN,
      reason: reason ?? 'No reason provided',
    });
    if (dedupWarning) {
      await ctx.editReply(dedupWarning);
      return;
    }

    // Execute softban via service (use softbanById to support users not in server)
    const result = await moderationService.softbanById(
      guild,
      targetId,
      targetTag,
      moderator,
      reason,
      deleteDays
    );

    if (!result.success) {
      await ctx.editReply(
        buildModActionError(
          result.error ?? 'Failed to softban the user.',
          'Check bot permissions and role hierarchy.'
        )
      );
      return;
    }

    // Log to mod channel (works even without user object - will use ID)
    await logModAction(
      guild,
      ModAction.SOFTBAN,
      target ?? { id: targetId, tag: targetTag },
      moderator,
      reason ?? 'No reason provided',
      ensureNonNull(
        result.caseNumber,
        '_softban > handleSoftban > logModAction(94): result.caseNumber'
      )
    );

    await ctx.editReply(
      buildModActionSuccess(
        'Softban',
        target ?? { id: targetId, tag: targetTag },
        ensureNonNull(
          result.caseNumber,
          '_softban > handleSoftban > buildModActionSuccess: result.caseNumber'
        ),
        reason ?? 'No reason provided',
        undefined,
        { guildId: guild.id }
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in softban command:', error);
    await ctx
      .editReply(
        errorMessage('Error', 'An unexpected error occurred while processing the softban.')
      )
      .catch(() => {});
  }
}
