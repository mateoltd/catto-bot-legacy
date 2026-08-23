import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { UserSelectMenuInteraction, GuildMember } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { EMOJI } from '#lib/discord/design/index.js';
import { decodeCustomId } from '#lib/discord/core/index.js';
import { getTempVoiceServices } from '../../modules/temp-voice/services/service-container.js';

export class TempVoiceUserSelectHandler extends InteractionHandler {
  public constructor(ctx: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.SelectMenu,
    });
  }

  public override parse(interaction: UserSelectMenuInteraction) {
    // New format: tv:action_select:channelId
    if (interaction.customId.startsWith('tv:') && interaction.customId.includes('_select')) {
      return this.some();
    }
    // Legacy format: tempvoice_action_select_channelId
    if (
      interaction.customId.startsWith('tempvoice_') &&
      interaction.customId.includes('_select_')
    ) {
      return this.some();
    }

    return this.none();
  }

  public async run(interaction: UserSelectMenuInteraction) {
    if (!interaction.guild || !interaction.guildId) {
      return interaction.reply({
        content: `${EMOJI.STATUS.ERROR} This command can only be used in a server.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const { action, channelId } = this.parseCustomId(interaction.customId);
    if (!channelId) {
      return this.safeReply(interaction, `${EMOJI.STATUS.ERROR} Invalid user select interaction.`);
    }

    const { operations } = getTempVoiceServices();

    // Build operation context
    const ctx = await operations.buildContext(interaction.guild, channelId);
    if (!ctx) {
      return this.safeReply(
        interaction,
        `${EMOJI.STATUS.ERROR} This temporary voice channel no longer exists.`
      );
    }

    // Permission check
    const member = interaction.member as GuildMember;
    const accessError = operations.checkAccess(member, ctx.tempChannel, ctx.config);
    if (accessError) {
      return this.safeReply(interaction, `${EMOJI.STATUS.ERROR} ${accessError}`);
    }

    const selectedUsers = interaction.values;

    // Route to appropriate handler
    switch (action) {
      case 'permit':
        return this.handleOperation(interaction, () => operations.permit(ctx, selectedUsers));
      case 'deny':
        return this.handleOperation(interaction, () => operations.deny(ctx, selectedUsers));
      case 'trust':
        return this.handleOperation(interaction, () => operations.toggleTrust(ctx, selectedUsers));
      case 'kick':
        return this.handleOperation(interaction, () => operations.kick(ctx, selectedUsers));
      case 'transfer':
        return this.handleTransfer(interaction, ctx, selectedUsers, member);
      default:
        return this.safeReply(interaction, `${EMOJI.STATUS.ERROR} Unknown action.`);
    }
  }

  // ───── Custom ID Parsing ─────

  private parseCustomId(customId: string): { action: string; channelId: string } {
    // New format: tv:permit_select:channelId
    if (customId.startsWith('tv:')) {
      const parsed = decodeCustomId(customId);
      // action is e.g. "permit_select" — strip the _select suffix to get the action
      const action = parsed.action.replace(/_select$/, '');
      return { action, channelId: parsed.params[0] || '' };
    }

    // Legacy format: tempvoice_permit_select_channelId
    const parts = customId.split('_');
    // parts: ['tempvoice', action, 'select', channelId]
    return { action: parts[1] || '', channelId: parts[3] || '' };
  }

  // ───── Generic Operation Handler ─────

  private async handleOperation(
    interaction: UserSelectMenuInteraction,
    operationFn: () => Promise<{ ok: boolean; message: string }>
  ) {
    try {
      await interaction.deferUpdate();
      const result = await operationFn();
      const emoji = result.ok ? EMOJI.STATUS.SUCCESS : EMOJI.STATUS.ERROR;
      return interaction.editReply({
        content: `${emoji} ${result.message}`,
        components: [],
      });
    } catch (error) {
      this.container.logger.error('User select operation failed:', error);
      if (!interaction.deferred) {
        return interaction.update({
          content: `${EMOJI.STATUS.ERROR} An unexpected error occurred. Please try again.`,
          components: [],
        });
      }
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} An unexpected error occurred. Please try again.`,
        components: [],
      });
    }
  }

  // ───── Transfer (with ownership check) ─────

  private async handleTransfer(
    interaction: UserSelectMenuInteraction,
    ctx: import('../../modules/temp-voice/services/operations.service.js').OperationContext,
    userIds: string[],
    member: GuildMember
  ) {
    try {
      await interaction.deferUpdate();

      // Only one user can be selected for transfer
      if (userIds.length !== 1) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} You can only transfer ownership to one user.`,
          components: [],
        });
      }

      const newOwnerId = userIds[0];
      if (!newOwnerId) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} Invalid user selection.`,
          components: [],
        });
      }

      // Only the owner or admins can transfer ownership
      const { operations } = getTempVoiceServices();
      const accessError = operations.checkAccess(member, ctx.tempChannel, ctx.config);
      if (accessError) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} ${accessError}`,
          components: [],
        });
      }

      const result = await operations.transfer(ctx, newOwnerId);
      const emoji = result.ok ? EMOJI.STATUS.SUCCESS : EMOJI.STATUS.ERROR;
      return interaction.editReply({
        content: `${emoji} ${result.message}`,
        components: [],
      });
    } catch (error) {
      this.container.logger.error('[TempVoice UserSelect] Failed to transfer ownership:', error);
      if (!interaction.deferred) {
        return interaction.update({
          content: `${EMOJI.STATUS.ERROR} Failed to transfer ownership. Please try again.`,
          components: [],
        });
      }
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} Failed to transfer ownership. Please try again.`,
        components: [],
      });
    }
  }

  // ───── Safe Reply Helper ─────

  /**
   * Try to update the message first (removes components), fall back to ephemeral reply.
   */
  private async safeReply(interaction: UserSelectMenuInteraction, content: string) {
    try {
      return await interaction.update({
        content,
        components: [],
      });
    } catch {
      return interaction.reply({
        content,
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
