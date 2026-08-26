import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ButtonInteraction, GuildMember } from "discord.js";
import {
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { EMOJI } from "#lib/discord/design/index.js";
import { decodeCustomId, encodeCustomId } from "#lib/discord/core/index.js";
import { getTempVoiceServices } from "../../modules/temp-voice/services/service-container.js";
import type { OperationContext } from "../../modules/temp-voice/services/operations.service.js";
import { getTempVoiceOwnershipPage } from "../../modules/temp-voice/application/temp-voice-ownership-view.js";
import { TempVoiceOwnershipStatus } from "@prisma/client";

export class TempVoiceButtonHandler extends InteractionHandler {
  public constructor(
    ctx: InteractionHandler.LoaderContext,
    options: InteractionHandler.Options,
  ) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.Button,
    });
  }

  public override parse(interaction: ButtonInteraction) {
    // New format: tv:action:channelId
    if (interaction.customId.startsWith("tv:")) return this.some();
    // Legacy format: tempvoice_action_channelId
    if (interaction.customId.startsWith("tempvoice_")) return this.some();

    return this.none();
  }

  public async run(interaction: ButtonInteraction) {
    if (interaction.customId.startsWith("tv:grace_page:")) {
      return this.handleGracePage(interaction);
    }

    if (!interaction.guild || !interaction.guildId) {
      return interaction.reply({
        content: `${EMOJI.STATUS.ERROR} This command can only be used in a server.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const { action, channelId } = this.parseCustomId(interaction.customId);
    if (!channelId) {
      return interaction.reply({
        content: `${EMOJI.STATUS.ERROR} Invalid button interaction.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const { operations } = getTempVoiceServices();

    // Build operation context (fetches tempChannel + config)
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

    const member = interaction.member as GuildMember;

    // Category buttons and refresh don't need permission or customization checks
    if (["settings", "users"].includes(action)) {
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
      return this.handleCategory(
        interaction,
        action as "settings" | "users",
        channelId,
      );
    }

    if (action === "ownership") {
      return this.showOwnershipSubMenu(interaction, channelId, ctx, member);
    }

    if (action === "refresh") {
      return this.handleRefresh(interaction, ctx);
    }

    // Permission check for all other actions
    if (action !== "claim") {
      const accessError =
        action === "transfer"
          ? operations.checkTransferAccess(member, ctx.tempChannel, ctx.config)
          : operations.checkAccess(member, ctx.tempChannel, ctx.config);
      if (accessError) {
        return interaction.reply({
          content: `${EMOJI.STATUS.ERROR} ${accessError}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // Check if customization is allowed (except transfer which is always allowed)
    if (
      !ctx.config.allowCustomization &&
      !["transfer", "claim"].includes(action)
    ) {
      return interaction.reply({
        content: `${EMOJI.STATUS.ERROR} Channel customization is disabled in this server.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Route to appropriate handler
    switch (action) {
      // Direct operations — delegate to operations service
      case "lock":
        return this.handleOperation(interaction, () =>
          operations.toggleLock(ctx),
        );
      case "hide":
        return this.handleOperation(interaction, () =>
          operations.toggleHide(ctx),
        );
      case "reset":
        return this.handleOperation(interaction, () => operations.reset(ctx));
      case "claim":
        return this.handleOperation(interaction, () =>
          operations.claim(ctx, member.id, member.voice.channelId),
        );

      // Modal actions
      case "rename":
        return this.showRenameModal(interaction, channelId);
      case "limit":
        return this.showLimitModal(interaction, channelId);
      case "settings_modal":
        return this.showSettingsModal(interaction, ctx, channelId);

      // User-select actions
      case "permit":
        return this.showUserSelect(
          interaction,
          channelId,
          "permit",
          "Select user(s) to permit",
          `${EMOJI.USER.ACTIONS.INVITE} Select the user(s) you want to permit access to this channel:`,
        );
      case "deny":
        return this.showUserSelect(
          interaction,
          channelId,
          "deny",
          "Select user(s) to deny",
          `${EMOJI.MODERATION.STATE.SUSPICIOUS} Select the user(s) you want to deny access to this channel:`,
        );
      case "trust":
        return this.showTrustSelect(interaction, channelId, ctx);
      case "kick":
        return this.showUserSelect(
          interaction,
          channelId,
          "kick",
          "Select user(s) to kick",
          `${EMOJI.MODERATION.ACTIONS.KICK} Select the user(s) you want to kick from this channel:`,
        );
      case "transfer":
        return this.showTransferSelect(interaction, channelId);

      default:
        return interaction.reply({
          content: `${EMOJI.STATUS.ERROR} Unknown action.`,
          flags: MessageFlags.Ephemeral,
        });
    }
  }

  // ───── Custom ID Parsing ─────

  private parseCustomId(customId: string): {
    action: string;
    channelId: string;
  } {
    // New format: tv:action:channelId
    if (customId.startsWith("tv:")) {
      const parsed = decodeCustomId(customId);
      return { action: parsed.action, channelId: parsed.params[0] || "" };
    }

    // Legacy format: tempvoice_action_channelId
    const parts = customId.split("_");
    return { action: parts[1] || "", channelId: parts[2] || "" };
  }

  // ───── Category Sub-Menu Handlers ─────

  private async handleCategory(
    interaction: ButtonInteraction,
    category: "settings" | "users",
    channelId: string,
  ) {
    switch (category) {
      case "settings":
        return this.showSettingsSubMenu(interaction, channelId);
      case "users":
        return this.showUsersSubMenu(interaction, channelId);
    }
  }

  private async showSettingsSubMenu(
    interaction: ButtonInteraction,
    channelId: string,
  ) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(encodeCustomId("tv", "lock", channelId))
        .setEmoji(EMOJI.CHANNELS.STATE.LOCKED)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(encodeCustomId("tv", "hide", channelId))
        .setEmoji(EMOJI.UI.INDICATORS.HIDDEN)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(encodeCustomId("tv", "rename", channelId))
        .setEmoji(EMOJI.UI.ACTIONS.EDIT)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(encodeCustomId("tv", "limit", channelId))
        .setEmoji(EMOJI.CHANNELS.STATE.VOICE_LIMITED_WHITE)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(encodeCustomId("tv", "reset", channelId))
        .setLabel("Reset")
        .setEmoji(EMOJI.UI.NAV.REPLAY)
        .setStyle(ButtonStyle.Secondary),
    );

    return interaction.reply({
      content: `${EMOJI.UI.ACTIONS.SETTINGS} **Channel Settings**`,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  private async showUsersSubMenu(
    interaction: ButtonInteraction,
    channelId: string,
  ) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(encodeCustomId("tv", "permit", channelId))
        .setEmoji(EMOJI.USER.ACTIONS.INVITE)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(encodeCustomId("tv", "deny", channelId))
        .setEmoji(EMOJI.MODERATION.STATE.SUSPICIOUS)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(encodeCustomId("tv", "trust", channelId))
        .setEmoji(EMOJI.UI.ACTIONS.ADD_GREEN)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(encodeCustomId("tv", "kick", channelId))
        .setEmoji(EMOJI.MODERATION.ACTIONS.KICK)
        .setStyle(ButtonStyle.Secondary),
    );

    return interaction.reply({
      content: `${EMOJI.USER.ICONS.MULTIPLE_MEMBERS} **User Management**`,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  private async showOwnershipSubMenu(
    interaction: ButtonInteraction,
    channelId: string,
    ctx: OperationContext,
    member: GuildMember,
  ) {
    const claimable =
      ctx.tempChannel.ownershipStatus === TempVoiceOwnershipStatus.CLAIMABLE;
    const insideChannel = member.voice.channelId === channelId;
    const transferError = getTempVoiceServices().operations.checkTransferAccess(
      member,
      ctx.tempChannel,
      ctx.config,
    );
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(encodeCustomId("tv", "claim", channelId))
        .setLabel("Claim")
        .setEmoji(EMOJI.USER.ROLES.OWNER)
        .setDisabled(!claimable || !insideChannel)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(encodeCustomId("tv", "transfer", channelId))
        .setEmoji(EMOJI.UI.NAV.RIGHT)
        .setDisabled(transferError !== null)
        .setStyle(ButtonStyle.Secondary),
    );

    const stateMessage = claimable
      ? "This channel is open for claim by a human member currently inside it."
      : ctx.tempChannel.ownershipStatus === TempVoiceOwnershipStatus.OWNER_GRACE
        ? "The owner can return or choose a successor while the grace period is active."
        : "Ownership is healthy. The owner may still transfer it voluntarily.";

    return interaction.reply({
      content: `${EMOJI.USER.ROLES.OWNER} **Ownership**\n${stateMessage}`,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  // ───── Refresh ─────

  private async handleRefresh(
    interaction: ButtonInteraction,
    ctx: OperationContext,
  ) {
    const result = await getTempVoiceServices().operations.reconcile(ctx);
    return interaction.reply({
      content: `${result.ok ? EMOJI.STATUS.SUCCESS : EMOJI.STATUS.ERROR} ${result.message}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  private async handleGracePage(interaction: ButtonInteraction) {
    const parsed = decodeCustomId(interaction.customId);
    const [guildId, channelId, epochValue, pageValue] = parsed.params;
    if (!guildId || !channelId || !epochValue || !pageValue) {
      return interaction.reply({
        content: `${EMOJI.STATUS.ERROR} Invalid ownership prompt.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    const ownershipEpoch = Number.parseInt(epochValue, 10);
    const requestedPage = Number.parseInt(pageValue, 10);
    const page = await getTempVoiceOwnershipPage({
      guildId,
      channelId,
      actorId: interaction.user.id,
      ownershipEpoch,
      page: requestedPage,
    });
    if (!page || page.candidates.length === 0) {
      return interaction.update({
        content: `${EMOJI.STATUS.ERROR} This ownership prompt is no longer active.`,
        components: [],
      });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(
        encodeCustomId(
          "tv",
          "grace_transfer_select",
          guildId,
          channelId,
          String(ownershipEpoch),
          String(page.page),
        ),
      )
      .setPlaceholder("Choose the new owner")
      .addOptions(
        page.candidates.map((candidate) => ({
          label: candidate.displayName.slice(0, 100),
          description: candidate.username.slice(0, 100),
          value: candidate.id,
        })),
      );
    const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
    ];
    if (page.pageCount > 1) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(
              encodeCustomId(
                "tv",
                "grace_page",
                guildId,
                channelId,
                String(ownershipEpoch),
                String(Math.max(0, page.page - 1)),
              ),
            )
            .setLabel("Previous")
            .setDisabled(page.page === 0)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(
              encodeCustomId(
                "tv",
                "grace_page",
                guildId,
                channelId,
                String(ownershipEpoch),
                String(Math.min(page.pageCount - 1, page.page + 1)),
              ),
            )
            .setLabel("Next")
            .setDisabled(page.page === page.pageCount - 1)
            .setStyle(ButtonStyle.Secondary),
        ),
      );
    }
    return interaction.update({
      content: `Choose a new owner for <#${channelId}>.`,
      components: rows,
    });
  }

  // ───── Generic Operation Handler ─────

  private async handleOperation(
    interaction: ButtonInteraction,
    operationFn: () => Promise<{ ok: boolean; message: string }>,
  ) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const result = await operationFn();
      const emoji = result.ok ? EMOJI.STATUS.SUCCESS : EMOJI.STATUS.ERROR;
      return interaction.editReply({
        content: `${emoji} ${result.message}`,
      });
    } catch (error) {
      this.container.logger.error(
        "[TempVoice Button] Operation failed:",
        error,
      );
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} An unexpected error occurred. Please try again.`,
      });
    }
  }

  // ───── Modal Launchers ─────

  private async showRenameModal(
    interaction: ButtonInteraction,
    channelId: string,
  ) {
    const modal = new ModalBuilder()
      .setCustomId(encodeCustomId("tv", "rename_modal", channelId))
      .setTitle("Rename Channel");

    const nameInput = new TextInputBuilder()
      .setCustomId("channel_name")
      .setLabel("New Channel Name")
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(100)
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(
      nameInput,
    );
    modal.addComponents(row);

    return interaction.showModal(modal);
  }

  private async showLimitModal(
    interaction: ButtonInteraction,
    channelId: string,
  ) {
    const modal = new ModalBuilder()
      .setCustomId(encodeCustomId("tv", "limit_modal", channelId))
      .setTitle("Set User Limit");

    const limitInput = new TextInputBuilder()
      .setCustomId("user_limit")
      .setLabel("User Limit (0 for unlimited)")
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(2)
      .setPlaceholder("0-99")
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(
      limitInput,
    );
    modal.addComponents(row);

    return interaction.showModal(modal);
  }

  private async showSettingsModal(
    interaction: ButtonInteraction,
    ctx: OperationContext,
    channelId: string,
  ) {
    const modal = new ModalBuilder()
      .setCustomId(encodeCustomId("tv", "settings_modal", channelId))
      .setTitle("Channel Settings");

    const bitrateInput = new TextInputBuilder()
      .setCustomId("bitrate")
      .setLabel("Bitrate (kbps)")
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(3)
      .setPlaceholder("8-384")
      .setValue(((ctx.tempChannel.customBitrate || 64000) / 1000).toString())
      .setRequired(false);

    const regionInput = new TextInputBuilder()
      .setCustomId("region")
      .setLabel("Region (auto, us-east, etc.)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("auto")
      .setValue(ctx.tempChannel.customRegion || "auto")
      .setRequired(false);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(
      bitrateInput,
    );
    const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(
      regionInput,
    );
    modal.addComponents(row1, row2);

    return interaction.showModal(modal);
  }

  // ───── User Select Launchers ─────

  private async showUserSelect(
    interaction: ButtonInteraction,
    channelId: string,
    selectAction: string,
    placeholder: string,
    content: string,
  ) {
    const userSelect = new UserSelectMenuBuilder()
      .setCustomId(encodeCustomId("tv", `${selectAction}_select`, channelId))
      .setPlaceholder(placeholder)
      .setMinValues(1)
      .setMaxValues(10);

    const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      userSelect,
    );

    return interaction.reply({
      content,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  private async showTrustSelect(
    interaction: ButtonInteraction,
    channelId: string,
    ctx: OperationContext,
  ) {
    const trustedUsers = Array.isArray(ctx.tempChannel.trustedUserIds)
      ? (ctx.tempChannel.trustedUserIds as string[])
      : [];

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId(encodeCustomId("tv", "trust_select", channelId))
      .setPlaceholder("Select user(s) to trust/untrust")
      .setMinValues(1)
      .setMaxValues(10);

    const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      userSelect,
    );

    let content = `${EMOJI.UI.ACTIONS.ADD_GREEN} **Trust/Untrust Users**\nSelect users to toggle their trust status. Trusted users can manage the channel (except transfer ownership).`;

    if (trustedUsers.length > 0) {
      const mentions = trustedUsers.map((id) => `<@${id}>`).join(", ");
      content += `\n\n**Currently trusted:** ${mentions}`;
    }

    return interaction.reply({
      content,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  private async showTransferSelect(
    interaction: ButtonInteraction,
    channelId: string,
  ) {
    const userSelect = new UserSelectMenuBuilder()
      .setCustomId(encodeCustomId("tv", "transfer_select", channelId))
      .setPlaceholder("Select new owner")
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      userSelect,
    );

    return interaction.reply({
      content: `${EMOJI.UI.NAV.RIGHT} Select the user you want to transfer ownership to:`,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }
}
