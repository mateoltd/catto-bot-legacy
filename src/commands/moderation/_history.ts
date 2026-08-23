import type { HistoryOptions } from '#lib/interaction/typedOptions.js';
import type { CommandResponder } from '#lib/discord/index.js';
import { moderationService } from '../../modules/moderation/services/ModerationService.js';
import { createHistoryEmbed } from '../../modules/moderation/discord/embeds/presets.js';
import { getHistoryPaginationBase } from '../../modules/moderation/discord/customId.js';
import { infoMessage, errorMessage, safeTag } from '#lib/discord/index.js';

export async function handleHistory(options: HistoryOptions, ctx: CommandResponder) {
  await ctx.deferPublic();

  try {
    const cases = await moderationService.getUserCases(options.guildId, options.targetId);

    if (cases.length === 0) {
      await ctx.editReply(infoMessage(`${safeTag(options.target.tag)} has no moderation history.`));
      return;
    }

    const message = createHistoryEmbed(options.target, cases, {
      page: 1,
      paginationCustomIdBase: getHistoryPaginationBase(options.targetId, 1),
    });
    await ctx.editReply(message);
  } catch (error) {
    ctx.client.logger.error('Error in history command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An unexpected error occurred while fetching the history.'))
      .catch(() => {});
  }
}
