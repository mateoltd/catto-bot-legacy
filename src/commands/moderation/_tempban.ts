import { ModAction } from '@prisma/client';
import type { GuildMember } from 'discord.js';
import { moderationService } from '../../modules/moderation/services/ModerationService.js';
import {
  logModAction,
  notifyUser,
  formatDuration,
} from '../../modules/moderation/discord/embeds/presets.js';
import {
  buildModActionError,
  buildModActionSuccess,
} from '../../modules/moderation/discord/panelBuilder.js';
import { commandDedupCheck } from '../../modules/moderation/handlers/dedupCheck.js';
import type { TempbanOptions } from '#lib/interaction/typedOptions.js';
import { errorMessage } from '#lib/discord/index.js';
import type { CommandResponder } from '#lib/discord/index.js';
import { ensureNonNull } from '#root/lib/utils.js';
import { Gate, isFail } from '#lib/validation/Gate.js';

export async function handleTempban(options: TempbanOptions, ctx: CommandResponder) {
  const { target, targetId, reason, durationSeconds, deleteMessages, guild, moderator } = options;

  const maxDuration = 365 * 24 * 60 * 60;
  if (durationSeconds > maxDuration) {
    await ctx.replyError('Maximum tempban duration is 1 year.');
    return;
  }

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
    // User is not in the server - that's fine for tempban
  }

  // Check hierarchy using Gate (only if target is in server)
  if (targetMember) {
    const hierarchyResult = gate.checkHierarchy(targetMember);
    if (isFail(hierarchyResult)) {
      await gate.deny(hierarchyResult, ctx);
      return;
    }

    // Notify user before tempban (only if they're in server)
    if (target) {
      await notifyUser(target, ModAction.TEMPBAN, guild, reason, durationSeconds);
    }
  }

  await ctx.defer();

  try {
    const targetTag = target?.tag ?? `User ID: ${targetId}`;

    // Dedup check
    const dedupWarning = await commandDedupCheck({
      guild,
      target: target ?? { id: targetId, tag: targetTag },
      moderator,
      action: ModAction.TEMPBAN,
      reason: reason ?? 'No reason provided',
      duration: durationSeconds,
      extra: { deleteMessages },
    });
    if (dedupWarning) {
      await ctx.editReply(dedupWarning);
      return;
    }

    const result = await moderationService.tempbanById(
      guild,
      targetId,
      targetTag,
      moderator,
      reason,
      durationSeconds,
      deleteMessages
    );

    if (!result.success) {
      await ctx.editReply(
        buildModActionError(
          result.error ?? 'Failed to tempban the user.',
          'Check bot permissions and try again.'
        )
      );
      return;
    }

    await logModAction(
      guild,
      ModAction.TEMPBAN,
      target ?? { id: targetId, tag: targetTag },
      moderator,
      reason ?? 'No reason provided',
      ensureNonNull(result.caseNumber, 'tempban > handleTempban: result.caseNumber'),
      durationSeconds
    );

    await ctx.editReply(
      buildModActionSuccess(
        'Tempban',
        target ?? { id: targetId, tag: targetTag },
        ensureNonNull(
          result.caseNumber,
          '_tempban > handleTempban > buildModActionSuccess: result.caseNumber'
        ),
        reason ?? 'No reason provided',
        formatDuration(durationSeconds),
        { guildId: guild.id }
      )
    );
  } catch (error) {
    ctx.client.logger.error('Error in tempban command:', error);
    await ctx
      .editReply(
        errorMessage('Error', 'An unexpected error occurred while processing the tempban.')
      )
      .catch(() => {});
  }
}
