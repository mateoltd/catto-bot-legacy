import { CaseStatus } from '@prisma/client';
import type { CommandResponder } from '#lib/discord/index.js';
import type { VoidOptions } from '#lib/interaction/typedOptions.js';
import { handleCaseClose } from './_caseManagement.js';

export type { VoidOptions };

export async function handleCaseVoid(options: VoidOptions, ctx: CommandResponder) {
  return handleCaseClose(
    {
      caseNumber: options.caseNumber,
      status: CaseStatus.VOID,
      successDescription: options.reason ? `**Void Reason:** ${options.reason}` : undefined,
      guild: options.guild,
      guildId: options.guildId,
      moderator: options.moderator,
    },
    ctx
  );
}
