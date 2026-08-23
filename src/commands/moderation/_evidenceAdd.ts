import type { Guild, User } from 'discord.js';
import { container } from '@sapphire/framework';
import type { CommandResponder } from '#lib/discord/index.js';
import { Gate } from '#lib/validation/Gate.js';
import { evidenceService } from '#modules/moderation/services/EvidenceService.js';
import { successContainer, EMOJI } from '#lib/discord/index.js';

export interface EvidenceAddOptions {
  caseNumber: number;
  guild: Guild;
  guildId: string;
  moderator: User;
}

export async function handleEvidenceAdd(options: EvidenceAddOptions, ctx: CommandResponder) {
  const gate = Gate.fromMember(ctx.member, ctx.guild);

  if (!(await gate.requireAuth('mod.evidence.add', ctx))) return;

  await ctx.defer();

  try {
    // Verify case exists
    const modCase = await container.prisma.modCase.findFirst({
      where: { guildId: gate.guild.id, caseNumber: options.caseNumber },
    });

    if (!modCase) {
      await ctx.editReply(
        successContainer()
          .h2(`${EMOJI.STATUS.ERROR} Case Not Found`)
          .text(`Case #${options.caseNumber} was not found in this server.`)
      );
      return;
    }

    // Generate dashboard URL
    const dashboardUrl = evidenceService.generateEvidenceListUrl(gate.guild.id, options.caseNumber);

    const result = successContainer()
      .h2(`${EMOJI.STATUS.INFO} Add Evidence to Case #${options.caseNumber}`)
      .text('Use the dashboard to upload files, add URLs, or capture messages as evidence.')
      .text(
        `Evidence is stored securely with integrity verification and is immutable once verified.`
      )
      .linkButtons({ url: dashboardUrl, label: 'Open Evidence Dashboard' });

    await ctx.editReply(result);
  } catch (error) {
    ctx.client.logger.error('Error in evidence add command:', error);
    await ctx
      .editReply(
        successContainer().h2(`${EMOJI.STATUS.ERROR} Error`).text('An unexpected error occurred.')
      )
      .catch(() => {});
  }
}
