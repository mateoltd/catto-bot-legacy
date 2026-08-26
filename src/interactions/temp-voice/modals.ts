import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ModalSubmitInteraction, GuildMember } from "discord.js";
import { MessageFlags, type VoiceChannel } from "discord.js";
import { EMOJI } from "#lib/discord/design/index.js";
import { decodeCustomId } from "#lib/discord/core/index.js";
import { getTempVoiceServices } from "../../modules/temp-voice/services/service-container.js";
import { NameModerationService } from "#modules/temp-voice/services/moderation/name-moderation.service.js";

export class TempVoiceModalHandler extends InteractionHandler {
  private moderationService!: NameModerationService;

  public constructor(
    ctx: InteractionHandler.LoaderContext,
    options: InteractionHandler.Options,
  ) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
    });
  }

  public override parse(interaction: ModalSubmitInteraction) {
    // New format: tv:action_modal:channelId
    if (interaction.customId.startsWith("tv:")) return this.some();
    // Legacy format: tempvoice_action_modal_channelId
    if (interaction.customId.startsWith("tempvoice_")) return this.some();

    return this.none();
  }

  public async run(interaction: ModalSubmitInteraction) {
    try {
      if (!interaction.guild || !interaction.guildId) {
        return interaction.reply({
          content: `${EMOJI.STATUS.ERROR} This command can only be used in a server.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const { action, channelId } = this.parseCustomId(interaction.customId);
      if (!channelId) {
        return interaction.reply({
          content: `${EMOJI.STATUS.ERROR} Invalid modal interaction.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const { operations } = getTempVoiceServices();

      // Build operation context
      const ctx = await operations.buildContext(
        interaction.guild,
        channelId,
        interaction.user.id,
      );
      if (!ctx) {
        return interaction.reply({
          content: `${EMOJI.STATUS.ERROR} This temporary voice channel no longer exists.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // Permission check
      const member = interaction.member as GuildMember;
      const accessError = operations.checkAccess(
        member,
        ctx.tempChannel,
        ctx.config,
      );
      if (accessError) {
        return interaction.reply({
          content: `${EMOJI.STATUS.ERROR} ${accessError}`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // Route to appropriate handler
      switch (action) {
        case "rename":
        case "rename_modal":
          return this.handleRenameSubmit(interaction, ctx);
        case "limit":
        case "limit_modal":
          return this.handleLimitSubmit(interaction, ctx);
        case "settings":
        case "settings_modal":
          return this.handleSettingsSubmit(interaction, ctx);
        default:
          return interaction.reply({
            content: `${EMOJI.STATUS.ERROR} Unknown modal action.`,
            flags: MessageFlags.Ephemeral,
          });
      }
    } catch (error) {
      this.container.logger.error(
        `[TempVoice Modal] Unhandled error processing modal ${interaction.customId}:`,
        error,
      );
      // Reply only if not already replied/deferred
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: `${EMOJI.STATUS.ERROR} An unexpected error occurred while processing your input. Please try again.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }
  }

  // ───── Custom ID Parsing ─────

  private parseCustomId(customId: string): {
    action: string;
    channelId: string;
  } {
    // New format: tv:rename_modal:channelId
    if (customId.startsWith("tv:")) {
      const parsed = decodeCustomId(customId);
      return { action: parsed.action, channelId: parsed.params[0] || "" };
    }

    // Legacy format: tempvoice_rename_modal_channelId
    const parts = customId.split("_");
    // parts: ['tempvoice', action, 'modal', channelId]
    return { action: parts[1] || "", channelId: parts[3] || "" };
  }

  // ───── Rename ─────

  private async handleRenameSubmit(
    interaction: ModalSubmitInteraction,
    ctx: import("../../modules/temp-voice/services/operations.service.js").OperationContext,
  ) {
    // Initialize moderation service lazily
    if (!this.moderationService) {
      this.moderationService = new NameModerationService(
        this.container.prisma,
        this.container.logger,
      );
    }

    const newName = interaction.fields.getTextInputValue("channel_name").trim();

    if (newName.length < 1 || newName.length > 100) {
      return interaction.reply({
        content: `${EMOJI.STATUS.ERROR} Channel name must be between 1 and 100 characters.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Defer early — rename involves multiple API calls that can be slow or rate-limited
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { operations } = getTempVoiceServices();

    try {
      // Fetch the voice channel for moderation checks
      const voiceChannel = (await ctx.guild.channels.fetch(ctx.channelId, {
        force: true,
      })) as VoiceChannel | null;
      if (!voiceChannel || !voiceChannel.isVoiceBased()) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} Voice channel not found.`,
        });
      }

      let finalName = newName;

      // Apply moderation if enabled
      if (ctx.config.moderationEnabled) {
        const oldName = voiceChannel.name;
        const moderationResult =
          await this.moderationService.moderateChannelName(
            voiceChannel,
            oldName,
            newName,
            ctx.config,
            interaction.user.id,
          );

        if (moderationResult && !moderationResult.validation.isAllowed) {
          finalName = moderationResult.finalName;

          if (ctx.config.moderationAction === "AUTO_RENAME") {
            // Moderation service already renamed the channel; delegate remaining DB/prefs/panel updates
            await operations.rename(ctx, finalName);
            return interaction.editReply({
              content: `${EMOJI.STATUS.WARNING} Your channel name was automatically changed to **${finalName}** because "${newName}" contains inappropriate content.`,
            });
          } else if (ctx.config.moderationAction === "BLOCK") {
            return interaction.editReply({
              content: `${EMOJI.STATUS.ERROR} That channel name is not allowed. Please choose a different name.`,
            });
          }
        }
      }

      // Mark as bot rename to prevent channelUpdate listener from re-processing
      if (ctx.config.moderationEnabled) {
        this.moderationService.markAsBotRename(voiceChannel.id, finalName);
      }

      // Delegate to operations service
      const result = await operations.rename(ctx, finalName);
      const emoji = result.ok ? EMOJI.STATUS.SUCCESS : EMOJI.STATUS.ERROR;
      return interaction.editReply({
        content: `${emoji} ${result.message}`,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.container.logger.error(
        `[TempVoice Modal] Failed to rename channel ${ctx.channelId}:`,
        error,
      );
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} Failed to rename channel: ${errMsg}`,
      });
    }
  }

  // ───── Limit ─────

  private async handleLimitSubmit(
    interaction: ModalSubmitInteraction,
    ctx: import("../../modules/temp-voice/services/operations.service.js").OperationContext,
  ) {
    const limitStr = interaction.fields.getTextInputValue("user_limit").trim();
    const limit = parseInt(limitStr, 10);

    if (isNaN(limit) || limit < 0 || limit > 99) {
      return interaction.reply({
        content: `${EMOJI.STATUS.ERROR} User limit must be a number between 0 and 99.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { operations } = getTempVoiceServices();

    try {
      const result = await operations.setLimit(ctx, limit);
      const emoji = result.ok ? EMOJI.STATUS.SUCCESS : EMOJI.STATUS.ERROR;
      return interaction.editReply({
        content: `${emoji} ${result.message}`,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.container.logger.error(
        `[TempVoice Modal] Failed to set user limit for channel ${ctx.channelId}:`,
        error,
      );
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} Failed to set user limit: ${errMsg}`,
      });
    }
  }

  // ───── Settings (Bitrate / Region) ─────

  private async handleSettingsSubmit(
    interaction: ModalSubmitInteraction,
    ctx: import("../../modules/temp-voice/services/operations.service.js").OperationContext,
  ) {
    const bitrateStr = interaction.fields.getTextInputValue("bitrate").trim();
    const region =
      interaction.fields.getTextInputValue("region").trim() || "auto";

    const bitrate = parseInt(bitrateStr, 10);
    if (isNaN(bitrate) || bitrate < 8 || bitrate > 384) {
      return interaction.reply({
        content: `${EMOJI.STATUS.ERROR} Bitrate must be between 8 and 384 kbps.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { operations } = getTempVoiceServices();

    try {
      // Set bitrate first
      const bitrateResult = await operations.setBitrate(ctx, bitrate);
      if (!bitrateResult.ok) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} ${bitrateResult.message}`,
        });
      }

      // Then set region
      const regionResult = await operations.setRegion(ctx, region);
      if (!regionResult.ok) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} ${regionResult.message}`,
        });
      }

      return interaction.editReply({
        content: `${EMOJI.STATUS.SUCCESS} Settings updated:\n- Bitrate: **${bitrate}kbps**\n- Region: **${region}**`,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.container.logger.error(
        `[TempVoice Modal] Failed to update settings for channel ${ctx.channelId}:`,
        error,
      );
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} Failed to update settings: ${errMsg}`,
      });
    }
  }
}
