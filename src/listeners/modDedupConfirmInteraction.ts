/**
 * Mod Dedup Confirm Interaction Listener
 *
 * Handles the "Confirm Override" button shown when a duplicate mod action
 * is detected. Consumes the pending override from Redis and re-executes
 * the action with skipDedup=true.
 *
 * Custom ID format: moddedup:v1:confirm:{pendingId}
 *
 * @see https://github.com/cattxdev/catto.v2/issues/114
 */

import { Listener, container } from '@sapphire/framework';
import { Events, type Interaction, MessageFlags } from 'discord.js';
import { ModAction } from '@prisma/client';
import {
  consumePendingOverride,
  getPendingOverride,
  setDedup,
} from '#root/modules/moderation/services/DedupService.js';
import {
  buildModerationContext,
  executeWarn,
  executeKick,
  executeBan,
  executeSoftban,
  executeTimeout,
  executeTempban,
  executeMute,
  type MuteType,
} from '#root/modules/moderation/handlers/index.js';
import {
  buildModActionSuccess,
  buildModActionError,
} from '#root/modules/moderation/discord/panelBuilder.js';
import { getActionDisplay } from '#root/modules/moderation/discord/modlog.js';
import { formatDuration } from '#root/modules/moderation/discord/embeds/presets.js';
import {
  ACTION_TO_MOD_ACTION,
  MUTE_ACTION_TO_MOD_ACTION,
} from '#root/modules/moderation/domain/types.js';
import type { ModActionResult, DurationSeconds } from '#root/modules/moderation/domain/types.js';
import { ensureNonNull } from '#root/lib/utils.js';
import { ephemeralError } from '#lib/discord/index.js';
import { getGate } from '#lib/validation/gateContext.js';
import { isFail } from '#lib/validation/Gate.js';

const CONFIRM_PREFIX = 'moddedup:v1:confirm:';
const CANCEL_PREFIX = 'moddedup:v1:cancel:';

export class ModDedupConfirmInteractionListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.InteractionCreate });
  }

  public async run(interaction: Interaction) {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith(CANCEL_PREFIX)) {
      await this.handleCancel(interaction);
      return;
    }

    if (!interaction.customId.startsWith(CONFIRM_PREFIX)) return;

    const pendingId = interaction.customId.slice(CONFIRM_PREFIX.length);
    if (!pendingId) {
      await interaction.reply(ephemeralError('Invalid confirmation data.'));
      return;
    }

    const pending = await getPendingOverride(pendingId);
    if (!pending) {
      await interaction.reply(
        ephemeralError(
          'This confirmation has expired or was already used. Please retry the action.'
        )
      );
      return;
    }

    // Verify the clicking user is the same moderator who triggered the dedup warning
    if (interaction.user.id !== pending.moderatorId) {
      await interaction.reply(
        ephemeralError('Only the moderator who initiated this action can confirm it.')
      );
      return;
    }

    // Consume only after auth check, so unauthorized clicks cannot burn the token.
    const consumedPending = await consumePendingOverride(pendingId);
    if (!consumedPending) {
      await interaction.reply(
        ephemeralError('This confirmation was already used. Please retry the action.')
      );
      return;
    }

    const gate = getGate(interaction);
    if (!gate) {
      await interaction.reply(ephemeralError('This can only be used in a server.'));
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const ctxResult = await buildModerationContext({
        guild: gate.guild,
        targetId: consumedPending.targetId,
        moderator: interaction.user,
        moderatorMember: gate.member,
        reason: consumedPending.reason,
        duration: consumedPending.duration as DurationSeconds | undefined,
      });

      if (!ctxResult.success) {
        await interaction.editReply({
          components: [buildModActionError(ctxResult.error).build()],
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }

      // Mark skipDedup so we don't loop
      const ctx = { ...ctxResult.context, skipDedup: true };

      // Re-check hierarchy
      if (ctx.targetMember) {
        const h = gate.checkHierarchy(ctx.targetMember);
        if (isFail(h)) {
          await interaction.editReply({
            components: [buildModActionError(h.message).build()],
            flags: MessageFlags.IsComponentsV2,
          });
          return;
        }
      }

      let result: ModActionResult;
      const action = consumedPending.action as string;

      // Check if this is a mute action
      const muteActions = new Set<string>([
        ModAction.MUTE_TEXT,
        ModAction.MUTE_VOICE,
        ModAction.MUTE_BOTH,
      ]);

      if (muteActions.has(action)) {
        // Resolve the mute type from the extra data or from the action enum
        const muteType = (consumedPending.extra?.muteType as MuteType) ?? 'both';
        const muteResult = await executeMute(ctx, muteType);
        result = {
          success: muteResult.success,
          caseNumber: muteResult.caseNumber,
          error: muteResult.error,
          userNotified: false,
        };
      } else {
        // Standard mod actions
        switch (action) {
          case ModAction.WARN:
            result = await executeWarn(ctx);
            break;
          case ModAction.KICK:
            result = await executeKick(ctx);
            break;
          case ModAction.BAN:
            result = await executeBan(ctx, Boolean(consumedPending.extra?.deleteMessages));
            break;
          case ModAction.SOFTBAN:
            result = await executeSoftban(ctx);
            break;
          case ModAction.TIMEOUT:
            result = await executeTimeout(ctx);
            break;
          case ModAction.TEMPBAN:
            result = await executeTempban(ctx, Boolean(consumedPending.extra?.deleteMessages));
            break;
          default:
            await interaction.editReply({
              components: [buildModActionError('Unknown action type.').build()],
              flags: MessageFlags.IsComponentsV2,
            });
            return;
        }
      }

      if (!result.success) {
        await interaction.editReply({
          components: [buildModActionError(result.error ?? 'Action failed.').build()],
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }

      const caseNumber = ensureNonNull(result.caseNumber, 'dedup confirm > caseNumber');

      // Determine display label
      const modAction = (ACTION_TO_MOD_ACTION[action.toLowerCase()] ??
        MUTE_ACTION_TO_MOD_ACTION[consumedPending.extra?.muteType as string] ??
        action) as ModAction;
      const display = getActionDisplay(modAction);
      const durationText = consumedPending.duration
        ? formatDuration(consumedPending.duration)
        : undefined;

      // Re-establish the dedup window so a third moderator can't slip through
      await setDedup(
        consumedPending.guildId,
        consumedPending.targetId,
        modAction,
        interaction.user.id,
        interaction.user.tag,
        consumedPending.reason
      );

      const success = buildModActionSuccess(
        display.label,
        ctx.target,
        caseNumber,
        consumedPending.reason,
        durationText,
        { guildId: gate.guild.id }
      );

      await interaction.editReply({
        components: [success.build()],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      container.logger.error('[ModDedupConfirm] Error:', error);
      await interaction
        .editReply({
          components: [buildModActionError('An unexpected error occurred.').build()],
          flags: MessageFlags.IsComponentsV2,
        })
        .catch(() => {});
    }
  }

  private async handleCancel(interaction: Interaction) {
    if (!interaction.isButton()) return;

    const pendingId = interaction.customId.slice(CANCEL_PREFIX.length);
    if (!pendingId) {
      await interaction.reply(ephemeralError('Invalid cancellation data.'));
      return;
    }

    const pending = await getPendingOverride(pendingId);

    if (!pending) {
      await interaction.reply(
        ephemeralError('This action has already been cancelled or has expired.')
      );
      return;
    }

    if (interaction.user.id !== pending.moderatorId) {
      await interaction.reply(
        ephemeralError('Only the moderator who initiated this action can cancel it.')
      );
      return;
    }

    // Consume and discard the pending override
    const consumedPending = await consumePendingOverride(pendingId);
    if (!consumedPending) {
      await interaction.reply(
        ephemeralError('This action has already been cancelled or has expired.')
      );
      return;
    }

    // Update the original message to show cancellation
    try {
      await interaction.update({
        components: [buildModActionError('Action cancelled by moderator.').build()],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch {
      // If update fails (e.g. message too old), reply ephemerally
      await interaction.reply(ephemeralError('Action cancelled.'));
    }
  }
}
