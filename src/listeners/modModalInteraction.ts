import { Listener, container } from '@sapphire/framework';
import { Events, type Interaction, MessageFlags, type ModalSubmitInteraction } from 'discord.js';
import {
  decodeReasonModalCustomId,
  decodeDurationModalCustomId,
  decodeNoteModalCustomId,
  decodeMuteModalCustomId,
} from '#root/modules/moderation/discord/customId.js';
import {
  buildModActionSuccess,
  buildModActionError,
  buildDedupWarning,
} from '#root/modules/moderation/discord/panelBuilder.js';
import { getActionDisplay } from '#root/modules/moderation/discord/modlog.js';
import { notesService } from '#root/modules/moderation/services/NotesService.js';
import {
  buildModerationContext,
  executeWarn,
  executeKick,
  executeBan,
  executeSoftban,
  executeTimeout,
  executeTempban,
  executeMute,
} from '#root/modules/moderation/handlers/index.js';
import {
  asGuildId,
  asUserId,
  ACTION_TO_MOD_ACTION,
  MUTE_ACTION_TO_MOD_ACTION,
} from '#root/modules/moderation/domain/types.js';
import type { ModActionResult } from '#root/modules/moderation/domain/types.js';
import { formatDuration } from '#root/modules/moderation/discord/embeds/presets.js';
import { parseDurationToSeconds } from '#lib/interaction/typedOptions.js';
import { safeParse, durationStringSchema } from '#lib/validation/zod.js';
import { ensureNonNull } from '#root/lib/utils.js';
import { isFail, type Gate } from '#lib/validation/Gate.js';
import { getGate } from '#lib/validation/gateContext.js';
import { resolveModalKey } from '#lib/validation/resourceKey.js';
import { ephemeralError } from '#lib/discord/index.js';

export class ModModalInteractionListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.InteractionCreate });
  }

  public async run(interaction: Interaction) {
    if (!interaction.isModalSubmit() || !interaction.guildId) return;

    const id = interaction.customId;
    if (id.startsWith('modreason:')) await this.handleReasonModal(interaction);
    else if (id.startsWith('moddur:')) await this.handleDurationModal(interaction);
    else if (id.startsWith('modnote:')) await this.handleNoteModal(interaction);
    else if (id.startsWith('modmute:')) await this.handleMuteModal(interaction);
  }

  /** Gate + auth check for modal interactions */
  private async requireGate(interaction: ModalSubmitInteraction): Promise<Gate | null> {
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

  /** Send a V2 error response to a deferred interaction */
  private async editError(interaction: ModalSubmitInteraction, message: string): Promise<void> {
    await interaction.editReply({
      components: [buildModActionError(message).build()],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  // ─── Reason Modal (warn, kick, ban, softban) ───

  private async handleReasonModal(interaction: ModalSubmitInteraction): Promise<void> {
    const parsed = decodeReasonModalCustomId(interaction.customId);
    if (!parsed) return void (await interaction.reply(ephemeralError('Invalid modal data.')));

    const gate = await this.requireGate(interaction);
    if (!gate) return;

    const reason = interaction.fields.getTextInputValue('reason');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const ctxResult = await buildModerationContext({
        guild: gate.guild,
        targetId: parsed.targetId,
        moderator: interaction.user,
        moderatorMember: gate.member,
        reason,
      });
      if (!ctxResult.success) return void (await this.editError(interaction, ctxResult.error));

      const ctx = ctxResult.context;
      if (ctx.targetMember) {
        const h = gate.checkHierarchy(ctx.targetMember);
        if (isFail(h)) return void (await this.editError(interaction, h.message));
      }

      let result: ModActionResult;
      switch (parsed.action) {
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
        default:
          return void (await this.editError(interaction, 'Unknown action.'));
      }

      if (!result.success) {
        // Check if this is a dedup block — show override UI instead of plain error
        if (result.deduplicated?.pendingId) {
          const modAction = ACTION_TO_MOD_ACTION[parsed.action]!;
          const warning = buildDedupWarning(
            modAction,
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

      const caseNumber = ensureNonNull(result.caseNumber, 'reason modal > caseNumber');
      const modAction = ACTION_TO_MOD_ACTION[parsed.action]!;
      const label = getActionDisplay(modAction).label;
      const success = buildModActionSuccess(label, ctx.target, caseNumber, reason, undefined, {
        guildId: gate.guild.id,
      });
      await interaction.editReply({
        components: [success.build()],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      container.logger.error('[ModModal] Error in reason modal:', error);
      await this.editError(interaction, 'An unexpected error occurred.').catch(() => {});
    }
  }

  // ─── Duration Modal (timeout, tempban) ───

  private async handleDurationModal(interaction: ModalSubmitInteraction): Promise<void> {
    const parsed = decodeDurationModalCustomId(interaction.customId);
    if (!parsed) return void (await interaction.reply(ephemeralError('Invalid modal data.')));

    const gate = await this.requireGate(interaction);
    if (!gate) return;

    const durationStr = interaction.fields.getTextInputValue('duration');
    const reason = interaction.fields.getTextInputValue('reason');

    if (!safeParse(durationStringSchema, durationStr).success) {
      return void (await interaction.reply(
        ephemeralError('Invalid duration format. Use formats like: 10m, 1h, 1d')
      ));
    }
    const duration = parseDurationToSeconds(durationStr);
    if (!duration) return void (await interaction.reply(ephemeralError('Invalid duration.')));

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const ctxResult = await buildModerationContext({
        guild: gate.guild,
        targetId: parsed.targetId,
        moderator: interaction.user,
        moderatorMember: gate.member,
        reason,
        duration,
      });
      if (!ctxResult.success) return void (await this.editError(interaction, ctxResult.error));

      const ctx = ctxResult.context;
      if (ctx.targetMember) {
        const h = gate.checkHierarchy(ctx.targetMember);
        if (isFail(h)) return void (await this.editError(interaction, h.message));
      }

      let result: ModActionResult;
      switch (parsed.action) {
        case 'timeout':
          result = await executeTimeout(ctx);
          break;
        case 'tempban':
          result = await executeTempban(ctx);
          break;
        default:
          return void (await this.editError(interaction, 'Unknown action.'));
      }

      if (!result.success) {
        if (result.deduplicated?.pendingId) {
          const modAction = ACTION_TO_MOD_ACTION[parsed.action]!;
          const warning = buildDedupWarning(
            modAction,
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

      const caseNumber = ensureNonNull(result.caseNumber, 'duration modal > caseNumber');
      const modAction = ACTION_TO_MOD_ACTION[parsed.action]!;
      const label = getActionDisplay(modAction).label;
      const success = buildModActionSuccess(
        label,
        ctx.target,
        caseNumber,
        reason,
        formatDuration(duration),
        { guildId: gate.guild.id }
      );
      await interaction.editReply({
        components: [success.build()],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      container.logger.error('[ModModal] Error in duration modal:', error);
      await this.editError(interaction, 'An unexpected error occurred.').catch(() => {});
    }
  }

  // ─── Note Modal ───

  private async handleNoteModal(interaction: ModalSubmitInteraction): Promise<void> {
    const parsed = decodeNoteModalCustomId(interaction.customId);
    if (!parsed) return void (await interaction.reply(ephemeralError('Invalid modal data.')));

    const gate = await this.requireGate(interaction);
    if (!gate) return;

    const note = interaction.fields.getTextInputValue('note');
    const tagsStr = interaction.fields.getTextInputValue('tags');
    const tags = tagsStr
      ? tagsStr
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0)
      : [];

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const target = await interaction.client.users.fetch(parsed.targetId).catch(() => null);
      if (!target) return void (await interaction.editReply({ content: '❌ User not found.' }));

      const result = await notesService.addNote({
        guildId: asGuildId(gate.guild.id),
        userId: asUserId(parsed.targetId),
        createdById: asUserId(interaction.user.id),
        note,
        tags,
      });

      if (!result.success)
        return void (await interaction.editReply({ content: `❌ ${result.error}` }));

      const tagsDisplay =
        tags.length > 0 ? `\n**Tags:** ${tags.map((t) => `\`${t}\``).join(', ')}` : '';
      await interaction.editReply({
        content: `Note added for **${target.tag}**${tagsDisplay}\n**Note ID:** \`${result.noteId}\``,
      });
    } catch (error) {
      container.logger.error('[ModModal] Error in note modal:', error);
      await interaction.editReply({ content: 'An unexpected error occurred.' }).catch(() => {});
    }
  }

  // ─── Mute Modal ───

  private async handleMuteModal(interaction: ModalSubmitInteraction): Promise<void> {
    const parsed = decodeMuteModalCustomId(interaction.customId);
    if (!parsed) return void (await interaction.reply(ephemeralError('Invalid modal data.')));

    const gate = await this.requireGate(interaction);
    if (!gate) return;

    const durationStr = interaction.fields.getTextInputValue('duration');
    const reason = interaction.fields.getTextInputValue('reason');

    let duration;
    if (durationStr?.trim()) {
      if (!safeParse(durationStringSchema, durationStr).success) {
        return void (await interaction.reply(
          ephemeralError('Invalid duration format. Use formats like: 10m, 1h, 1d')
        ));
      }
      duration = parseDurationToSeconds(durationStr) ?? undefined;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const ctxResult = await buildModerationContext({
        guild: gate.guild,
        targetId: parsed.targetId,
        moderator: interaction.user,
        moderatorMember: gate.member,
        reason,
        duration,
      });
      if (!ctxResult.success) return void (await this.editError(interaction, ctxResult.error));

      const ctx = ctxResult.context;
      if (ctx.targetMember) {
        const h = gate.checkHierarchy(ctx.targetMember);
        if (isFail(h)) return void (await this.editError(interaction, h.message));
      }

      const result = await executeMute(ctx, parsed.action);
      if (!result.success) {
        if (result.deduplicated?.pendingId) {
          const muteModAction = MUTE_ACTION_TO_MOD_ACTION[parsed.action]!;
          const warning = buildDedupWarning(
            muteModAction,
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
        return void (await this.editError(interaction, result.error ?? 'Mute action failed.'));
      }

      const caseNumber = ensureNonNull(result.caseNumber, 'mute modal > caseNumber');
      const durationText = duration ? formatDuration(duration) : undefined;
      const modAction = MUTE_ACTION_TO_MOD_ACTION[parsed.action]!;
      const label = getActionDisplay(modAction).label;
      const success = buildModActionSuccess(label, ctx.target, caseNumber, reason, durationText, {
        guildId: gate.guild.id,
      });
      await interaction.editReply({
        components: [success.build()],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      container.logger.error('[ModModal] Error in mute modal:', error);
      await this.editError(interaction, 'An unexpected error occurred.').catch(() => {});
    }
  }
}
