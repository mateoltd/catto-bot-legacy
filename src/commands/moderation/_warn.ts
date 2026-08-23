import { ModAction } from '@prisma/client';
import { moderationService } from '../../modules/moderation/services/ModerationService.js';
import { logModAction, notifyUser } from '../../modules/moderation/discord/embeds/presets.js';
import {
  buildModActionSuccess,
  buildModActionError,
} from '../../modules/moderation/discord/panelBuilder.js';
import { commandDedupCheck } from '../../modules/moderation/handlers/dedupCheck.js';
import type { WarnOptions } from '#lib/interaction/typedOptions.js';
import { errorMessage } from '#lib/discord/index.js';
import type { CommandResponder } from '#lib/discord/index.js';
import { ensureNonNull } from '#root/lib/utils.js';
import { Gate, isFail } from '#lib/validation/Gate.js';

export async function handleWarn(options: WarnOptions, ctx: CommandResponder) {
  // Create gate for validation
  const gate = Gate.fromMember(ctx.member, ctx.guild);

  // Resolve target and check hierarchy (authorization already checked by precondition)
  const targetMember = await gate.resolveMember(options.target.id);
  if (!targetMember) {
    await ctx.replyError('Target is not a member of this server.');
    return;
  }

  // Check hierarchy
  const hierarchyResult = gate.checkHierarchy(targetMember);
  if (isFail(hierarchyResult)) {
    await gate.deny(hierarchyResult, ctx);
    return;
  }

  await ctx.defer();

  try {
    // Dedup check
    const dedupWarning = await commandDedupCheck({
      guild: options.guild,
      target: options.target,
      moderator: options.moderator,
      action: ModAction.WARN,
      reason: options.reason ?? 'No reason provided',
    });
    if (dedupWarning) {
      await ctx.editReply(dedupWarning);
      return;
    }

    // Notify user before warn
    const notified = await notifyUser(
      options.target,
      ModAction.WARN,
      options.guild,
      options.reason
    );

    // Execute warn via service
    const result = await moderationService.warn(
      options.guild,
      options.target,
      options.moderator,
      options.reason
    );

    if (!result.success) {
      await ctx.editReply(
        buildModActionError(
          result.error ?? 'An unexpected error occurred while processing the warning.'
        )
      );
      return;
    }

    // Log to mod channel
    await logModAction(
      options.guild,
      ModAction.WARN,
      options.target,
      options.moderator,
      options.reason ?? 'No reason provided',
      ensureNonNull(result.caseNumber, '_warn > handleWarn > logModAction(82): result.caseNumber')
    );

    await ctx.editReply(
      buildModActionSuccess(
        'Warning',
        options.target,
        ensureNonNull(
          result.caseNumber,
          '_warn > handleWarn > buildModActionSuccess(90): result.caseNumber'
        ),
        options.reason ?? 'No reason provided',
        undefined,
        { dmSent: notified, guildId: options.guild.id }
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in warn command:', error);
    await ctx
      .editReply(
        errorMessage('Error', 'An unexpected error occurred while processing the warning.')
      )
      .catch(() => {});
  }
}
