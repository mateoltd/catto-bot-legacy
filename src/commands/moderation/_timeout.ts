import { ModAction } from '@prisma/client';
import { moderationService } from '../../modules/moderation/services/ModerationService.js';
import {
  logModAction,
  notifyUser,
  formatDuration,
} from '../../modules/moderation/discord/embeds/presets.js';
import {
  buildModActionSuccess,
  buildModActionError,
} from '../../modules/moderation/discord/panelBuilder.js';
import { commandDedupCheck } from '../../modules/moderation/handlers/dedupCheck.js';
import type { TimeoutOptions } from '#lib/interaction/typedOptions.js';
import { errorMessage } from '#lib/discord/index.js';
import type { CommandResponder } from '#lib/discord/index.js';
import { ensureNonNull } from '#root/lib/utils.js';
import { Gate, isFail } from '#lib/validation/Gate.js';

export async function handleTimeout(options: TimeoutOptions, ctx: CommandResponder) {
  const durationMs = options.durationSeconds * 1000;
  const maxDuration = 28 * 24 * 60 * 60 * 1000;

  if (durationMs > maxDuration) {
    await ctx.replyError('Timeout duration cannot exceed 28 days.');
    return;
  }

  if (durationMs < 60 * 1000) {
    await ctx.replyError('Timeout duration must be at least 1 minute.');
    return;
  }

  // Create gate for validation
  const gate = Gate.fromMember(ctx.member, ctx.guild);

  // Fetch target member
  const targetMember = await gate.resolveMember(options.target.id);
  if (!targetMember) {
    await ctx.replyError('Target is not a member of this server.');
    return;
  }

  // Check bot permissions
  if (!options.guild.members.me?.permissions.has('ModerateMembers')) {
    await ctx.replyError('I do not have permission to timeout members.');
    return;
  }

  // Check hierarchy using Gate
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
      action: ModAction.TIMEOUT,
      reason: options.reason ?? 'No reason provided',
      duration: options.durationSeconds,
    });
    if (dedupWarning) {
      await ctx.editReply(dedupWarning);
      return;
    }

    // Notify user before timeout
    const notified = await notifyUser(
      options.target,
      ModAction.TIMEOUT,
      options.guild,
      options.reason,
      options.durationSeconds
    );

    // Execute timeout via service
    const result = await moderationService.timeout(
      options.guild,
      targetMember,
      options.moderator,
      options.reason,
      options.durationSeconds
    );

    if (!result.success) {
      await ctx.editReply(
        buildModActionError(
          result.error ?? 'Failed to timeout the user.',
          'Check bot permissions and role hierarchy.'
        )
      );
      return;
    }

    // Log to mod channel
    await logModAction(
      options.guild,
      ModAction.TIMEOUT,
      options.target,
      options.moderator,
      options.reason ?? 'No reason provided',
      ensureNonNull(
        result.caseNumber,
        '_timeout > handleTimeout > logModAction(114): result.caseNumber'
      ),
      options.durationSeconds
    );

    const durationText = formatDuration(options.durationSeconds);

    await ctx.editReply(
      buildModActionSuccess(
        'Timeout',
        options.target,
        ensureNonNull(
          result.caseNumber,
          '_timeout > handleTimeout > buildModActionSuccess(125): result.caseNumber'
        ),
        options.reason ?? 'No reason provided',
        durationText,
        { dmSent: notified, guildId: options.guild.id }
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in timeout command:', error);
    await ctx
      .editReply(
        errorMessage('Error', 'An unexpected error occurred while processing the timeout.')
      )
      .catch(() => {});
  }
}
