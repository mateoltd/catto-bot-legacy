import type { Guild, User } from 'discord.js';
import { CaseStatus } from '@prisma/client';
import type { CommandResponder } from '#lib/discord/index.js';
import { caseService } from '../../modules/moderation/services/CaseService.js';
import { asGuildId } from '../../modules/moderation/domain/types.js';
import { errorMessage, successMessage } from '#lib/discord/index.js';

export interface CaseEditOptions {
  caseNumber: number;
  reason: string;
  guild: Guild;
  guildId: string;
  moderator: User;
}

export interface CaseLinkOptions {
  caseNumber: number;
  messageLink: string;
  guild: Guild;
  guildId: string;
}

export interface CaseCloseOptions {
  caseNumber: number;
  status?: CaseStatus;
  successDescription?: string;
  guild: Guild;
  guildId: string;
  moderator: User;
}

export async function handleCaseEdit(options: CaseEditOptions, ctx: CommandResponder) {
  await ctx.defer();

  try {
    const result = await caseService.editReason(
      asGuildId(options.guildId),
      options.caseNumber,
      options.reason
    );

    if (!result.success) {
      await ctx.editReply(errorMessage('Error', result.error ?? 'Failed to edit case.'));
      return;
    }

    await ctx.editReply(
      successMessage(`Case #${options.caseNumber} Updated`, `**New Reason:** ${options.reason}`)
    );
  } catch (error) {
    ctx.client.logger.error('Error in case edit command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An unexpected error occurred while editing the case.'))
      .catch(() => {});
  }
}

export async function handleCaseLink(options: CaseLinkOptions, ctx: CommandResponder) {
  const messageLinkRegex = /^https:\/\/discord\.com\/channels\/\d+\/\d+\/\d+$/;
  if (!messageLinkRegex.test(options.messageLink)) {
    await ctx.replyError('Invalid message link format. Use a Discord message link.');
    return;
  }

  await ctx.defer();

  try {
    const result = await caseService.linkEvidence(asGuildId(options.guildId), options.caseNumber, {
      messageLinks: [options.messageLink],
    });

    if (!result.success) {
      await ctx.editReply(errorMessage('Error', result.error ?? 'Failed to link evidence.'));
      return;
    }

    await ctx.editReply(
      successMessage(
        `Evidence Linked to Case #${options.caseNumber}`,
        `**Link:** ${options.messageLink}`
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in case link command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An unexpected error occurred while linking evidence.'))
      .catch(() => {});
  }
}

export async function handleCaseClose(options: CaseCloseOptions, ctx: CommandResponder) {
  const status = options.status ?? CaseStatus.CLOSED;

  await ctx.defer();

  try {
    const result = await caseService.closeCase(
      asGuildId(options.guildId),
      options.caseNumber,
      status
    );

    if (!result.success) {
      await ctx.editReply(errorMessage('Error', result.error ?? 'Failed to close case.'));
      return;
    }

    const statusLabel = status === CaseStatus.VOID ? 'voided' : 'closed';
    await ctx.editReply(
      successMessage(
        `Case #${options.caseNumber} ${statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}`,
        options.successDescription
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in case close command:', error);
    await ctx
      .editReply(errorMessage('Error', 'An unexpected error occurred while closing the case.'))
      .catch(() => {});
  }
}
