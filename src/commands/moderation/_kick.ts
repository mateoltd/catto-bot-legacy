import { ModAction } from '@prisma/client';
import { moderationService } from '../../modules/moderation/services/ModerationService.js';
import { logModAction, notifyUser } from '../../modules/moderation/discord/embeds/presets.js';
import {
  buildModActionSuccess,
  buildModActionError,
} from '../../modules/moderation/discord/panelBuilder.js';
import { commandDedupCheck } from '../../modules/moderation/handlers/dedupCheck.js';
import type { KickOptions } from '#lib/interaction/typedOptions.js';
import { errorMessage } from '#lib/discord/index.js';
import type { CommandResponder } from '#lib/discord/index.js';
import { ensureNonNull } from '#root/lib/utils.js';
import { Gate, isFail } from '#lib/validation/Gate.js';

export async function handleKick(options: KickOptions, ctx: CommandResponder) {
  await ctx.defer();

  // Get Gate for hierarchy validation
  const gate = Gate.fromMember(ctx.member, ctx.guild);

  try {
    // Fetch target member
    let targetMember;
    try {
      targetMember = await options.guild.members.fetch(options.target.id);
    } catch {
      await ctx.editReply(errorMessage('Error', 'Target is not a member of this server.'));
      return;
    }

    // Check bot permissions
    if (!options.guild.members.me?.permissions.has('KickMembers')) {
      await ctx.editReply(errorMessage('Error', 'I do not have permission to kick members.'));
      return;
    }

    // Check hierarchy using Gate
    const hierarchyResult = gate.checkHierarchy(targetMember);
    if (isFail(hierarchyResult)) {
      await ctx.editReply(hierarchyResult.response);
      return;
    }

    // Dedup check
    const dedupWarning = await commandDedupCheck({
      guild: options.guild,
      target: options.target,
      moderator: options.moderator,
      action: ModAction.KICK,
      reason: options.reason ?? 'No reason provided',
    });
    if (dedupWarning) {
      await ctx.editReply(dedupWarning);
      return;
    }

    // Notify user before kick
    const notified = await notifyUser(
      options.target,
      ModAction.KICK,
      options.guild,
      options.reason
    );

    // Execute kick via service
    const result = await moderationService.kick(
      options.guild,
      targetMember,
      options.moderator,
      options.reason
    );

    if (!result.success) {
      await ctx.editReply(
        buildModActionError(
          result.error ?? 'Failed to kick the user.',
          'Check bot permissions and role hierarchy.'
        )
      );
      return;
    }

    // Log to mod channel
    await logModAction(
      options.guild,
      ModAction.KICK,
      options.target,
      options.moderator,
      options.reason ?? 'No reason provided',
      ensureNonNull(result.caseNumber, 'logModAction(88): result.caseNumber')
    );

    await ctx.editReply(
      buildModActionSuccess(
        'Kick',
        options.target,
        ensureNonNull(result.caseNumber, 'buildModActionSuccess(96): result.caseNumber'),
        options.reason ?? 'No reason provided',
        undefined,
        { dmSent: notified, guildId: options.guild.id }
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in kick command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An unexpected error occurred while processing the kick.'))
      .catch(() => {});
  }
}
