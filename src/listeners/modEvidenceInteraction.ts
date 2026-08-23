import { Listener, container } from '@sapphire/framework';
import {
  Events,
  type Interaction,
  MessageFlags,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import {
  decodeEvidenceCaptureModalCustomId,
  decodeEvidencePendingActionCustomId,
  decodeEvidencePendingModActionCustomId,
  encodeEvidencePendingActionCustomId,
  encodeEvidencePendingModActionCustomId,
} from '#root/modules/moderation/discord/customId.js';
import {
  buildModActionSuccess,
  buildModActionError,
  buildDedupWarning,
} from '#root/modules/moderation/discord/panelBuilder.js';
import { getActionDisplay } from '#root/modules/moderation/discord/modlog.js';
import { evidenceService } from '#root/modules/moderation/services/EvidenceService.js';
import {
  executeWarn,
  executeKick,
  executeBan,
  executeSoftban,
  executeTimeout,
  executeTempban,
} from '#root/modules/moderation/handlers/execute.js';
import {
  buildModerationContext,
  type ModerationContext,
} from '#root/modules/moderation/handlers/index.js';
import { formatDuration } from '#root/modules/moderation/discord/embeds/presets.js';
import { ModAction } from '@prisma/client';
import type { ModActionResult } from '#root/modules/moderation/domain/types.js';
import {
  asDuration,
  asGuildId,
  ACTION_TO_MOD_ACTION,
} from '#root/modules/moderation/domain/types.js';
import { parseDurationToSeconds } from '#lib/interaction/typedOptions.js';
import { safeParse, durationStringSchema } from '#lib/validation/zod.js';
import { isFail, type Gate } from '#lib/validation/Gate.js';
import { getGate } from '#lib/validation/gateContext.js';
import { resolveModalKey, resolveSelectMenuKey } from '#lib/validation/resourceKey.js';
import {
  successContainer as makeSuccessContainer,
  errorContainer as makeErrorContainer,
  stringSelectRow,
  ephemeralError,
  formModal,
  paragraphModal,
  EMOJI,
} from '#lib/discord/index.js';

export class ModEvidenceInteractionListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.InteractionCreate });
  }

  public async run(interaction: Interaction) {
    if (!interaction.guildId) return;

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('evidence_pending:')) {
      await this.handleActionSelect(interaction);
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('evidence_capture:')) {
        await this.handleCaptureModal(interaction);
      } else if (interaction.customId.startsWith('evidence_pending_mod:')) {
        await this.handleModActionModal(interaction);
      }
    }
  }

  // ─── Helpers ───

  private async requireGateForModal(interaction: ModalSubmitInteraction): Promise<Gate | null> {
    const gate = getGate(interaction);
    if (!gate) {
      await interaction.reply(ephemeralError('This can only be used in a server.'));
      return null;
    }
    const key = resolveModalKey(interaction);
    if (!key) {
      await interaction.reply(ephemeralError('Invalid modal data.'));
      return null;
    }
    if (!(await gate.requireAuth(key))) return null;
    return gate;
  }

  private async editError(interaction: ModalSubmitInteraction, message: string): Promise<void> {
    await interaction.editReply({
      components: [buildModActionError(message).build()],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  // ─── Select Menu: Pick mod action after capture ───

  private async handleActionSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const parsed = decodeEvidencePendingActionCustomId(interaction.customId);
    if (!parsed) return;

    const gate = getGate(interaction);
    if (!gate) {
      return void (await interaction.reply(ephemeralError('This can only be used in a server.')));
    }

    const resourceKey = resolveSelectMenuKey(interaction);
    if (!resourceKey || !(await gate.requireAuth(resourceKey))) return;

    const action = interaction.values[0];
    if (!action) return;

    const { targetId, snapshotId } = parsed;

    try {
      if (action === 'none') {
        return void (await interaction.update({
          components: interaction.message.components.slice(0, -1),
        }));
      }

      const label = action.charAt(0).toUpperCase() + action.slice(1);
      const modalId = encodeEvidencePendingModActionCustomId(
        action as 'warn',
        targetId,
        snapshotId
      );

      if (action === 'warn' || action === 'kick' || action === 'ban' || action === 'softban') {
        await interaction.showModal(
          paragraphModal(modalId, `${label} User`, {
            customId: 'reason',
            label: 'Reason',
            placeholder: 'Enter the reason for this action...',
            required: true,
            maxLength: 512,
          })
        );
      } else if (action === 'timeout' || action === 'tempban') {
        await interaction.showModal(
          formModal(modalId, `${label} User`, [
            {
              id: 'duration',
              label: 'Duration (e.g., 10m, 1h, 1d)',
              type: 'short' as const,
              placeholder: '1h',
              required: true,
              maxLength: 10,
            },
            {
              id: 'reason',
              label: 'Reason',
              type: 'paragraph' as const,
              placeholder: 'Enter the reason for this action...',
              required: true,
              maxLength: 512,
            },
          ])
        );
      } else {
        await interaction.reply(ephemeralError('Unknown action.'));
      }
    } catch (error) {
      container.logger.error('[ModEvidence] Error handling action select:', error);
      await interaction.reply(ephemeralError('An unexpected error occurred.')).catch(() => {});
    }
  }

  // ─── Modal: Evidence Capture ───

  private async handleCaptureModal(interaction: ModalSubmitInteraction): Promise<void> {
    const parsed = decodeEvidenceCaptureModalCustomId(interaction.customId);
    if (!parsed) return void (await interaction.reply(ephemeralError('Invalid modal data.')));

    const gate = await this.requireGateForModal(interaction);
    if (!gate) return;

    const caseNumberStr = interaction.fields.getTextInputValue('case_number').trim();
    const captureRangeInput = interaction.fields.getTextInputValue('capture_range');
    const deleteInput = interaction.fields.getTextInputValue('delete_messages');

    // Parse capture range
    let lastMessageId: string | undefined;
    let messageCount: number | undefined;
    const trimmed = captureRangeInput?.trim();

    if (trimmed) {
      if (/^\d+$/.test(trimmed) && trimmed.length < 4) {
        const count = parseInt(trimmed, 10);
        if (count < 1 || count > 100) {
          return void (await interaction.reply({
            components: [
              makeErrorContainer()
                .h2(`${EMOJI.STATUS.ERROR} Invalid Count`)
                .text('Message count must be between 1 and 100.')
                .build(),
            ],
            flags: MessageFlags.Ephemeral,
          }));
        }
        messageCount = count;
      } else {
        const match = trimmed.match(/(\d{17,19})\s*$/);
        lastMessageId = match?.[1] ?? trimmed;
      }
    }

    const deleteAfterCapture = !deleteInput || deleteInput.toLowerCase() !== 'no';
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // Check for valid existing case
      let existingCase = null;
      let caseNumber: number | null = null;

      if (caseNumberStr) {
        caseNumber = parseInt(caseNumberStr, 10);
        if (!isNaN(caseNumber) && caseNumber >= 1) {
          existingCase = await container.prisma.modCase.findFirst({
            where: { guildId: gate.guild.id, caseNumber },
          });

          if (!existingCase) {
            const nextCaseNumber = await evidenceService.getNextCaseNumber(gate.guild.id);
            if (caseNumber < nextCaseNumber) {
              return void (await interaction.editReply({
                components: [
                  makeErrorContainer()
                    .h2(`${EMOJI.STATUS.ERROR} Invalid Case Number`)
                    .text(
                      `Case #${caseNumber} doesn't exist. Next available is #${nextCaseNumber}.`
                    )
                    .build(),
                ],
                flags: MessageFlags.IsComponentsV2,
              }));
            }
            // Case number >= nextCaseNumber — ignore and proceed with pending flow
            caseNumber = null;
          }
        } else {
          caseNumber = null;
        }
      }

      const captureParams = {
        guildId: gate.guild.id,
        channelId: parsed.channelId,
        firstMessageId: parsed.messageId,
        lastMessageId,
        messageCount,
        capturedById: gate.member.id,
        capturedByTag: gate.member.user.tag,
        deleteAfterCapture,
      };

      if (existingCase) {
        // Attach evidence to existing case
        const { snapshot, evidence } = await evidenceService.captureMessageRange(gate.guild, {
          ...captureParams,
          caseNumber: existingCase.caseNumber,
        });

        const dashboardUrl = evidenceService.generateEvidenceListUrl(
          gate.guild.id,
          existingCase.caseNumber
        );
        const successResult = makeSuccessContainer()
          .h2(`${EMOJI.STATUS.SUCCESS} Evidence Captured`)
          .text(
            `**${snapshot.messageCount}** message(s) attached to **Case #${existingCase.caseNumber}**.`
          )
          .text(`Evidence ID: \`${evidence!.id}\``)
          .text(deleteAfterCapture ? 'Original messages deleted.' : 'Original messages preserved.')
          .linkButtons({ url: dashboardUrl, label: 'View Evidence' });

        await interaction.editReply({
          components: [successResult.build()],
          flags: MessageFlags.IsComponentsV2,
        });
      } else {
        // Capture snapshot, wait for mod action to create case
        const { snapshot } = await evidenceService.captureMessageRange(gate.guild, captureParams);
        const snapshotData = snapshot.snapshotData as unknown as Array<{ authorId: string }>;
        const targetUserId = snapshotData?.[0]?.authorId;

        const successResult = makeSuccessContainer()
          .h2(`${EMOJI.STATUS.SUCCESS} Messages Captured`)
          .text(`**${snapshot.messageCount}** message(s) captured.`)
          .text('Select a mod action below to create a case and attach this evidence.')
          .text(deleteAfterCapture ? 'Original messages deleted.' : 'Original messages preserved.');

        if (targetUserId && targetUserId !== gate.member.id) {
          const selectRow = stringSelectRow({
            customId: encodeEvidencePendingActionCustomId(targetUserId, snapshot.id),
            placeholder: 'Take a mod action on the author?',
            options: [
              { label: 'No action', value: 'none', description: 'Dismiss this menu' },
              { label: 'Warn', value: 'warn', description: 'Issue a warning' },
              { label: 'Timeout', value: 'timeout', description: 'Timeout the user' },
              { label: 'Kick', value: 'kick', description: 'Kick from server' },
              { label: 'Ban', value: 'ban', description: 'Permanently ban' },
              { label: 'Softban', value: 'softban', description: 'Ban and unban (purge messages)' },
              { label: 'Tempban', value: 'tempban', description: 'Temporarily ban' },
            ],
          });
          await interaction.editReply({
            components: [successResult.build(), selectRow],
            flags: MessageFlags.IsComponentsV2,
          });
        } else {
          successResult.text(
            `\n⚠️ No action menu — author is ${targetUserId === gate.member.id ? 'you' : 'unknown'}.`
          );
          await interaction.editReply({
            components: [successResult.build()],
            flags: MessageFlags.IsComponentsV2,
          });
        }
      }
    } catch (error) {
      container.logger.error('[ModEvidence] Error in capture modal:', error);
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred.';
      await interaction
        .editReply({
          components: [
            makeErrorContainer().h2(`${EMOJI.STATUS.ERROR} Capture Failed`).text(msg).build(),
          ],
          flags: MessageFlags.IsComponentsV2,
        })
        .catch(() => {});
    }
  }

  // ─── Modal: Mod action after capture ───

  private async handleModActionModal(interaction: ModalSubmitInteraction): Promise<void> {
    const parsed = decodeEvidencePendingModActionCustomId(interaction.customId);
    if (!parsed) return void (await interaction.reply(ephemeralError('Invalid modal data.')));

    const gate = await this.requireGateForModal(interaction);
    if (!gate) return;

    const reason = interaction.fields.getTextInputValue('reason');

    let duration: number | undefined;
    if (parsed.action === 'timeout' || parsed.action === 'tempban') {
      const durationStr = interaction.fields.getTextInputValue('duration');
      if (!safeParse(durationStringSchema, durationStr).success) {
        return void (await interaction.reply(
          ephemeralError('Invalid duration format. Use formats like: 10m, 1h, 1d')
        ));
      }
      duration = parseDurationToSeconds(durationStr) ?? undefined;
      if (!duration) return void (await interaction.reply(ephemeralError('Invalid duration.')));
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const ctxResult = await buildModerationContext({
        guild: gate.guild,
        targetId: parsed.targetId,
        moderator: interaction.user,
        moderatorMember: gate.member,
        reason,
        duration: duration ? asDuration(duration) : undefined,
      });
      if (!ctxResult.success) return void (await this.editError(interaction, ctxResult.error));

      const ctx = ctxResult.context;
      if (ctx.targetMember) {
        const h = gate.checkHierarchy(ctx.targetMember);
        if (isFail(h)) return void (await this.editError(interaction, h.message));
      }

      // Execute action (creates case + logs) then link evidence
      const result = await this.executeActionAndLinkEvidence(ctx, parsed.action, parsed.snapshotId);
      if (!result.success) {
        if (result.deduplicated?.pendingId) {
          const dedupModAction =
            ACTION_TO_MOD_ACTION[parsed.action] ?? (parsed.action as ModAction);
          const warning = buildDedupWarning(
            dedupModAction,
            ctx.target.tag,
            result.deduplicated.moderatorTag,
            result.deduplicated.timestamp,
            result.deduplicated.pendingId
          );
          await interaction.editReply({
            components: [warning.build()],
            flags: MessageFlags.IsComponentsV2,
          });
          return;
        }
        return void (await this.editError(interaction, result.error ?? 'Action failed.'));
      }

      const modAction = ACTION_TO_MOD_ACTION[parsed.action];
      const label = modAction ? getActionDisplay(modAction).label : parsed.action;
      const durationText = duration ? formatDuration(duration) : undefined;
      const success = buildModActionSuccess(
        label,
        ctx.target,
        result.caseNumber!,
        reason,
        durationText,
        {
          guildId: gate.guild.id,
          evidenceAttached: true,
        }
      );
      await interaction.editReply({
        components: [success.build()],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      container.logger.error('[ModEvidence] Error in mod action modal:', error);
      await this.editError(interaction, 'An unexpected error occurred.').catch(() => {});
    }
  }

  private async executeActionAndLinkEvidence(
    ctx: ModerationContext,
    action: string,
    snapshotId: string
  ): Promise<ModActionResult> {
    let result: ModActionResult;

    switch (action) {
      case 'warn':
        result = await executeWarn(ctx);
        break;
      case 'kick':
        result = await executeKick(ctx);
        break;
      case 'ban':
        result = await executeBan(ctx);
        break;
      case 'softban':
        result = await executeSoftban(ctx);
        break;
      case 'timeout':
        result = await executeTimeout(ctx);
        break;
      case 'tempban':
        result = await executeTempban(ctx);
        break;
      default:
        return { success: false, error: 'Unknown action.', userNotified: false };
    }

    if (!result.success || !result.caseNumber) return result;

    // Link snapshot as evidence
    try {
      const modCase = await container.prisma.modCase.findFirst({
        where: { guildId: asGuildId(ctx.guild.id), caseNumber: result.caseNumber },
      });
      if (modCase) {
        await evidenceService.createEvidenceFromSnapshot(snapshotId, modCase.id, result.caseNumber);
      }
    } catch (error) {
      container.logger.warn('[ModEvidence] Failed to link evidence:', error);
    }

    return result;
  }
}
