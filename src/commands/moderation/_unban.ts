import { ModAction } from '@prisma/client';
import { moderationService } from '../../modules/moderation/services/ModerationService.js';
import { logModAction } from '../../modules/moderation/discord/embeds/presets.js';
import {
  buildModActionSuccess,
  buildModActionError,
} from '../../modules/moderation/discord/panelBuilder.js';
import type { UnbanOptions } from '#lib/interaction/typedOptions.js';
import { errorMessage } from '#lib/discord/index.js';
import type { CommandResponder } from '#lib/discord/index.js';
import { ensureNonNull } from '#root/lib/utils.js';

export async function handleUnban(options: UnbanOptions, ctx: CommandResponder) {
  await ctx.defer();

  try {
    // Check bot permissions
    if (!options.guild.members.me?.permissions.has('BanMembers')) {
      await ctx.editReply(errorMessage('Error', 'I do not have permission to unban members.'));
      return;
    }

    // Check if user is banned
    let ban;
    try {
      ban = await options.guild.bans.fetch(options.userId);
    } catch {
      await ctx.editReply(errorMessage('Error', 'This user is not banned.'));
      return;
    }

    // Execute unban via service
    const result = await moderationService.unban(
      options.guild,
      options.userId,
      ban.user.tag,
      options.moderator,
      options.reason
    );

    if (!result.success) {
      await ctx.editReply(
        buildModActionError(result.error ?? 'Failed to unban the user.', 'Check bot permissions.')
      );
      return;
    }

    // Log to mod channel
    await logModAction(
      options.guild,
      ModAction.UNBAN,
      ban.user,
      options.moderator,
      options.reason ?? 'No reason provided',
      ensureNonNull(result.caseNumber, '_unban > handleUnban > logModAction(74): result.caseNumber')
    );

    await ctx.editReply(
      buildModActionSuccess(
        'Unban',
        ban.user,
        ensureNonNull(
          result.caseNumber,
          '_unban > handleUnban > buildModActionSuccess(82): result.caseNumber'
        ),
        options.reason ?? 'No reason provided',
        undefined,
        { guildId: options.guild.id }
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in unban command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An unexpected error occurred while processing the unban.'))
      .catch(() => {});
  }
}
