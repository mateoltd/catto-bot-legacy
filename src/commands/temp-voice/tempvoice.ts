import { Command } from "@sapphire/framework";
import { ApplyOptions } from "@sapphire/decorators";
import { ChannelType, type GuildMember } from "discord.js";
import { EMOJI } from "#lib/discord/design/index.js";
import { getTempVoiceServices } from "../../modules/temp-voice/services/service-container.js";
import { NameModerationService } from "#modules/temp-voice/services/moderation/name-moderation.service.js";
import type { OperationContext } from "../../modules/temp-voice/services/operations.service.js";
import { handleVoiceSetup } from "./_setup.js";

@ApplyOptions<Command.Options>({
  name: "voice",
  description: "Manage your temporary voice channel",
  requiredUserPermissions: [],
  preconditions: ["GuildOnly"],
})
export class TempVoiceCommand extends Command {
  private moderationService!: NameModerationService;

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
          subcommand
            .setName("rename")
            .setDescription("Rename your temporary voice channel")
            .addStringOption((option) =>
              option
                .setName("name")
                .setDescription("New channel name")
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(100),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("limit")
            .setDescription("Set the user limit for your channel")
            .addIntegerOption((option) =>
              option
                .setName("limit")
                .setDescription("User limit (0 for unlimited, max 99)")
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(99),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("lock")
            .setDescription("Lock your channel (only allowed users can join)"),
        )
        .addSubcommand((subcommand) =>
          subcommand.setName("unlock").setDescription("Unlock your channel"),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("hide")
            .setDescription("Hide your channel from @everyone"),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("show")
            .setDescription("Make your channel visible to @everyone"),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("permit")
            .setDescription("Allow a user to join your locked/hidden channel")
            .addUserOption((option) =>
              option
                .setName("user")
                .setDescription("User to permit")
                .setRequired(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("deny")
            .setDescription("Deny a user from joining your channel")
            .addUserOption((option) =>
              option
                .setName("user")
                .setDescription("User to deny")
                .setRequired(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("trust")
            .setDescription("Trust a user to help manage your channel")
            .addUserOption((option) =>
              option
                .setName("user")
                .setDescription("User to trust")
                .setRequired(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("untrust")
            .setDescription("Remove trust from a user")
            .addUserOption((option) =>
              option
                .setName("user")
                .setDescription("User to untrust")
                .setRequired(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("kick")
            .setDescription("Kick a user from your channel")
            .addUserOption((option) =>
              option
                .setName("user")
                .setDescription("User to kick")
                .setRequired(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("transfer")
            .setDescription(
              "Transfer ownership of your channel to another user",
            )
            .addUserOption((option) =>
              option
                .setName("user")
                .setDescription("New owner")
                .setRequired(true),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("bitrate")
            .setDescription("Set the bitrate for your channel")
            .addIntegerOption((option) =>
              option
                .setName("bitrate")
                .setDescription("Bitrate in kbps (8-384)")
                .setRequired(true)
                .setMinValue(8)
                .setMaxValue(384),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("region")
            .setDescription("Set the region for your channel")
            .addStringOption((option) =>
              option
                .setName("region")
                .setDescription("Voice region")
                .setRequired(true)
                .addChoices(
                  { name: "Automatic", value: "auto" },
                  { name: "Brazil", value: "brazil" },
                  { name: "Hong Kong", value: "hongkong" },
                  { name: "India", value: "india" },
                  { name: "Japan", value: "japan" },
                  { name: "Rotterdam", value: "rotterdam" },
                  { name: "Russia", value: "russia" },
                  { name: "Singapore", value: "singapore" },
                  { name: "South Africa", value: "southafrica" },
                  { name: "Sydney", value: "sydney" },
                  { name: "US Central", value: "us-central" },
                  { name: "US East", value: "us-east" },
                  { name: "US South", value: "us-south" },
                  { name: "US West", value: "us-west" },
                ),
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("reset")
            .setDescription("Reset your channel to default settings"),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("claim")
            .setDescription(
              "Claim ownership of an abandoned temporary channel",
            ),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("panel")
            .setDescription("Show the control panel for your channel"),
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("setup")
            .setDescription(
              "Interactive setup wizard for temp voice (Manage Server)",
            ),
        ),
    );
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    if (!interaction.guild || !interaction.member) {
      return interaction.reply({
        content: `${EMOJI.STATUS.ERROR} This command can only be used in a server.`,
        ephemeral: true,
      });
    }

    const member = interaction.member as GuildMember;
    const subcommand = interaction.options.getSubcommand();

    // Setup doesn't require being in a voice channel
    if (subcommand === "setup") {
      return handleVoiceSetup(interaction);
    }

    // Must be in a voice channel
    const voiceChannel = member.voice.channel;
    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      return interaction.reply({
        content: `${EMOJI.STATUS.ERROR} You must be in a voice channel to use this command.`,
        ephemeral: true,
      });
    }

    const { operations } = getTempVoiceServices();

    // Build context (fetches temp channel + config)
    const ctx = await operations.buildContext(
      interaction.guild,
      voiceChannel.id,
      member.id,
    );
    if (!ctx) {
      return interaction.reply({
        content: `${EMOJI.STATUS.ERROR} This is not a temporary voice channel.`,
        ephemeral: true,
      });
    }

    // Permission check (except for claim which checks owner presence instead)
    if (subcommand !== "claim") {
      const accessError =
        subcommand === "transfer"
          ? operations.checkTransferAccess(member, ctx.tempChannel, ctx.config)
          : operations.checkAccess(member, ctx.tempChannel, ctx.config);
      if (accessError) {
        return interaction.reply({
          content: `${EMOJI.STATUS.ERROR} ${accessError}`,
          ephemeral: true,
        });
      }

      // Check if customization is allowed (except panel/claim/transfer)
      if (
        !ctx.config.allowCustomization &&
        !["panel", "transfer"].includes(subcommand)
      ) {
        return interaction.reply({
          content: `${EMOJI.STATUS.ERROR} Channel customization is disabled in this server.`,
          ephemeral: true,
        });
      }
    }

    // Route to operations service
    switch (subcommand) {
      case "lock":
        return this.handleToggleLock(interaction, ctx, true);
      case "unlock":
        return this.handleToggleLock(interaction, ctx, false);
      case "hide":
        return this.handleToggleHide(interaction, ctx, true);
      case "show":
        return this.handleToggleHide(interaction, ctx, false);
      case "rename":
        return this.handleRename(interaction, ctx);
      case "limit":
        return this.handleSimpleOp(interaction, () =>
          operations.setLimit(
            ctx,
            interaction.options.getInteger("limit", true),
          ),
        );
      case "permit":
        return this.handleSimpleOp(interaction, () =>
          operations.permit(ctx, [
            interaction.options.getUser("user", true).id,
          ]),
        );
      case "deny":
        return this.handleSimpleOp(interaction, () =>
          operations.deny(ctx, [interaction.options.getUser("user", true).id]),
        );
      case "trust":
        return this.handleSimpleOp(interaction, () =>
          operations.toggleTrust(ctx, [
            interaction.options.getUser("user", true).id,
          ]),
        );
      case "untrust":
        return this.handleSimpleOp(interaction, () =>
          operations.toggleTrust(ctx, [
            interaction.options.getUser("user", true).id,
          ]),
        );
      case "kick":
        return this.handleSimpleOp(interaction, () =>
          operations.kick(ctx, [interaction.options.getUser("user", true).id]),
        );
      case "transfer":
        return this.handleSimpleOp(interaction, () =>
          operations.transfer(
            ctx,
            interaction.options.getUser("user", true).id,
          ),
        );
      case "bitrate":
        return this.handleSimpleOp(interaction, () =>
          operations.setBitrate(
            ctx,
            interaction.options.getInteger("bitrate", true),
          ),
        );
      case "region":
        return this.handleSimpleOp(interaction, () =>
          operations.setRegion(
            ctx,
            interaction.options.getString("region", true),
          ),
        );
      case "reset":
        return this.handleSimpleOp(interaction, () => operations.reset(ctx));
      case "claim":
        return this.handleSimpleOp(interaction, () =>
          operations.claim(ctx, member.id, member.voice.channelId),
        );
      case "panel":
        return this.handlePanel(interaction, ctx);
      default:
        return interaction.reply({
          content: `${EMOJI.STATUS.ERROR} Unknown subcommand.`,
          ephemeral: true,
        });
    }
  }

  // ───── Generic operation handler ─────

  private async handleSimpleOp(
    interaction: Command.ChatInputCommandInteraction,
    operationFn: () => Promise<{ ok: boolean; message: string }>,
  ) {
    try {
      const result = await operationFn();
      const emoji = result.ok ? EMOJI.STATUS.SUCCESS : EMOJI.STATUS.ERROR;
      return interaction.reply({
        content: `${emoji} ${result.message}`,
        ephemeral: true,
      });
    } catch (error) {
      this.container.logger.error(
        "[TempVoice] Command operation failed:",
        error,
      );
      return interaction.reply({
        content: `${EMOJI.STATUS.ERROR} An unexpected error occurred. Please try again.`,
        ephemeral: true,
      });
    }
  }

  // ───── Lock/Unlock (directional, not toggle) ─────

  private async handleToggleLock(
    interaction: Command.ChatInputCommandInteraction,
    ctx: OperationContext,
    wantLocked: boolean,
  ) {
    // If already in desired state, just confirm
    if (ctx.tempChannel.isLocked === wantLocked) {
      return interaction.reply({
        content: wantLocked
          ? `${EMOJI.CHANNELS.STATE.LOCKED} Channel is already locked.`
          : `${EMOJI.CHANNELS.STATE.UNLOCKED} Channel is already unlocked.`,
        ephemeral: true,
      });
    }

    // toggleLock will flip to the desired state since current != desired
    return this.handleSimpleOp(interaction, () =>
      getTempVoiceServices().operations.toggleLock(ctx),
    );
  }

  // ───── Hide/Show (directional, not toggle) ─────

  private async handleToggleHide(
    interaction: Command.ChatInputCommandInteraction,
    ctx: OperationContext,
    wantHidden: boolean,
  ) {
    if (ctx.tempChannel.isHidden === wantHidden) {
      return interaction.reply({
        content: wantHidden
          ? `${EMOJI.UI.INDICATORS.HIDDEN} Channel is already hidden.`
          : `${EMOJI.UI.INDICATORS.VISIBILITY} Channel is already visible.`,
        ephemeral: true,
      });
    }

    return this.handleSimpleOp(interaction, () =>
      getTempVoiceServices().operations.toggleHide(ctx),
    );
  }

  // ───── Rename (with moderation) ─────

  private async handleRename(
    interaction: Command.ChatInputCommandInteraction,
    ctx: OperationContext,
  ) {
    if (!this.moderationService) {
      this.moderationService = new NameModerationService(
        this.container.prisma,
        this.container.logger,
      );
    }

    const newName = interaction.options.getString("name", true);
    const { operations } = getTempVoiceServices();

    try {
      let finalName = newName;

      // Apply moderation if enabled
      if (ctx.config.moderationEnabled) {
        const voiceChannel = await ctx.guild.channels.fetch(ctx.channelId, {
          force: true,
        });
        if (!voiceChannel || !voiceChannel.isVoiceBased()) {
          return interaction.reply({
            content: `${EMOJI.STATUS.ERROR} Voice channel not found.`,
            ephemeral: true,
          });
        }

        const oldName = voiceChannel.name;
        const moderationResult =
          await this.moderationService.moderateChannelName(
            voiceChannel as import("discord.js").VoiceChannel,
            oldName,
            newName,
            ctx.config,
            interaction.user.id,
          );

        if (moderationResult && !moderationResult.validation.isAllowed) {
          finalName = moderationResult.finalName;

          if (ctx.config.moderationAction === "AUTO_RENAME") {
            await operations.rename(ctx, finalName);
            return interaction.reply({
              content: `${EMOJI.STATUS.WARNING} Your channel name was automatically changed to **${finalName}** because "${newName}" contains inappropriate content.`,
              ephemeral: true,
            });
          } else if (ctx.config.moderationAction === "BLOCK") {
            return interaction.reply({
              content: `${EMOJI.STATUS.ERROR} That channel name is not allowed. Please choose a different name.`,
              ephemeral: true,
            });
          }
        }

        // Mark as bot rename to prevent channelUpdate listener from re-processing
        this.moderationService.markAsBotRename(ctx.channelId, finalName);
      }

      const result = await operations.rename(ctx, finalName);
      const emoji = result.ok ? EMOJI.STATUS.SUCCESS : EMOJI.STATUS.ERROR;
      return interaction.reply({
        content: `${emoji} ${result.message}`,
        ephemeral: true,
      });
    } catch (error) {
      this.container.logger.error(
        "[TempVoice] Failed to rename channel:",
        error,
      );
      return interaction.reply({
        content: `${EMOJI.STATUS.ERROR} Failed to rename channel. Please try again.`,
        ephemeral: true,
      });
    }
  }

  // ───── Panel ─────

  private async handlePanel(
    interaction: Command.ChatInputCommandInteraction,
    ctx: OperationContext,
  ) {
    try {
      const result = await getTempVoiceServices().operations.reconcile(ctx);

      return interaction.reply({
        content: `${result.ok ? EMOJI.STATUS.SUCCESS : EMOJI.STATUS.ERROR} ${result.message}`,
        ephemeral: true,
      });
    } catch (error) {
      this.container.logger.error(
        "[TempVoice] Failed to send control panel:",
        error,
      );
      return interaction.reply({
        content: `${EMOJI.STATUS.ERROR} Failed to send control panel. Please try again.`,
        ephemeral: true,
      });
    }
  }
}
