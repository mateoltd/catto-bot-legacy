import type { CaseOptions } from '#lib/interaction/typedOptions.js';
import type { CommandResponder } from '#lib/discord/index.js';
import { moderationService } from '../../modules/moderation/services/ModerationService.js';
import { createCaseEmbed } from '../../modules/moderation/discord/embeds/presets.js';
import { infoMessage, errorMessage } from '#lib/discord/index.js';

export async function handleCase(options: CaseOptions, ctx: CommandResponder) {
  await ctx.defer();

  try {
    const modCase = await moderationService.getCase(options.guildId, options.caseNumber);

    if (!modCase) {
      await ctx.editReply(infoMessage(`Case #${options.caseNumber} not found.`));
      return;
    }

    const message = createCaseEmbed(modCase);
    await ctx.editReply(message);
  } catch (error) {
    ctx.client.logger.error('Error in case command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An unexpected error occurred while fetching the case.'))
      .catch(() => {});
  }
}
