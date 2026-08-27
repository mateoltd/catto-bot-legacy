import { Args, Command } from "@sapphire/framework";
import { ApplyOptions } from "@sapphire/decorators";
import { ChannelType, type Message } from "discord.js";
import { EMOJI } from "#lib/discord/design/index.js";
import {
  InteractionResponder,
  MessageResponder,
  type CommandResponder,
} from "#lib/discord/index.js";
import {
  readPrefixArgs,
  resolvePrefixUser,
} from "#lib/interaction/prefixArgs.js";
import { getTempVoiceServices } from "../../modules/temp-voice/services/service-container.js";
import { NameModerationService } from "#modules/temp-voice/services/moderation/name-moderation.service.js";
import type { OperationContext } from "../../modules/temp-voice/services/operations.service.js";
import { handleVoiceSetup } from "./_setup.js";

interface TempVoiceRequest {
  subcommand: string;
  text?: string;
  number?: number;
  userId?: string;
}

const NO_ARGUMENT_SUBCOMMANDS = new Set([
  "lock",
  "unlock",
  "hide",
  "show",
  "reset",
  "claim",
  "panel",
  "setup",
]);

const VOICE_REGIONS = new Set([
  "auto",
  "brazil",
  "hongkong",
  "india",
  "japan",
  "rotterdam",
  "russia",
  "singapore",
  "southafrica",
  "sydney",
  "us-central",
  "us-east",
  "us-south",
  "us-west",
]);

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
    const subcommand = interaction.options.getSubcommand();
    const request: TempVoiceRequest = { subcommand };

    if (subcommand === "rename") {
      request.text = interaction.options.getString("name", true);
    } else if (subcommand === "limit") {
      request.number = interaction.options.getInteger("limit", true);
    } else if (subcommand === "bitrate") {
      request.number = interaction.options.getInteger("bitrate", true);
    } else if (subcommand === "region") {
      request.text = interaction.options.getString("region", true);
    } else if (
      ["permit", "deny", "trust", "untrust", "kick", "transfer"].includes(
        subcommand,
      )
    ) {
      request.userId = interaction.options.getUser("user", true).id;
    }

    return this.run(request, new InteractionResponder(interaction));
  }

  public override async messageRun(message: Message, args: Args) {
    const guildMessage = message as Message<true>;
    const responder = new MessageResponder(guildMessage);
    const values = await readPrefixArgs(args);
    const subcommand = values[0]?.toLocaleLowerCase();

    if (!subcommand) {
      return this.sendUsage(responder);
    }

    const request: TempVoiceRequest = { subcommand };

    if (NO_ARGUMENT_SUBCOMMANDS.has(subcommand)) {
      if (values.length > 1) return this.sendUsage(responder);
    } else if (subcommand === "rename") {
      const name = values.slice(1).join(" ").trim();
      if (!name || name.length > 100) return this.sendUsage(responder);
      request.text = name;
    } else if (subcommand === "limit" || subcommand === "bitrate") {
      const value = Number(values[1]);
      const validRange =
        subcommand === "limit"
          ? Number.isInteger(value) && value >= 0 && value <= 99
          : Number.isInteger(value) && value >= 8 && value <= 384;
      if (!validRange || values.length > 2) return this.sendUsage(responder);
      request.number = value;
    } else if (subcommand === "region") {
      const region = values[1]?.toLocaleLowerCase();
      if (!region || !VOICE_REGIONS.has(region) || values.length > 2) {
        return this.sendUsage(responder);
      }
      request.text = region;
    } else if (
      ["permit", "deny", "trust", "untrust", "kick", "transfer"].includes(
        subcommand,
      )
    ) {
      const user = values[1]
        ? await resolvePrefixUser(guildMessage, values[1])
        : null;
      if (!user || values.length > 2) return this.sendUsage(responder);
      request.userId = user.id;
    } else {
      return this.sendUsage(responder);
    }

    return this.run(request, responder);
  }

  private async sendUsage(ctx: CommandResponder) {
    const prefix = this.container.client.options.defaultPrefix ?? "!";
    return ctx.replyError(
      [
        `Usage: \`${prefix}voice <action> [value]\``,
        "Actions: rename, limit, lock, unlock, hide, show, permit, deny, trust, untrust, kick, transfer, bitrate, region, reset, claim, panel, setup",
      ].join("\n"),
    );
  }

  private async run(request: TempVoiceRequest, responder: CommandResponder) {
    const { subcommand } = request;

    // Setup doesn't require being in a voice channel
    if (subcommand === "setup") {
      return handleVoiceSetup(responder);
    }

    const member = responder.member;

    // Must be in a voice channel
    const voiceChannel = member.voice.channel;
    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      return responder.replyError(
        "You must be in a voice channel to use this command.",
      );
    }

    const { operations } = getTempVoiceServices();

    // Build context (fetches temp channel + config)
    const operationContext = await operations.buildContext(
      responder.guild,
      voiceChannel.id,
      member.id,
    );
    if (!operationContext) {
      return responder.replyError("This is not a temporary voice channel.");
    }

    // Permission check (except for claim which checks owner presence instead)
    if (subcommand !== "claim") {
      const accessError =
        subcommand === "transfer"
          ? operations.checkTransferAccess(
              member,
              operationContext.tempChannel,
              operationContext.config,
            )
          : operations.checkAccess(
              member,
              operationContext.tempChannel,
              operationContext.config,
            );
      if (accessError) {
        return responder.replyError(accessError);
      }

      // Check if customization is allowed (except panel/claim/transfer)
      if (
        !operationContext.config.allowCustomization &&
        !["panel", "transfer"].includes(subcommand)
      ) {
        return responder.replyError(
          "Channel customization is disabled in this server.",
        );
      }
    }

    // Route to operations service
    switch (subcommand) {
      case "lock":
        return this.handleToggleLock(responder, operationContext, true);
      case "unlock":
        return this.handleToggleLock(responder, operationContext, false);
      case "hide":
        return this.handleToggleHide(responder, operationContext, true);
      case "show":
        return this.handleToggleHide(responder, operationContext, false);
      case "rename": {
        if (request.text === undefined) return this.sendUsage(responder);
        return this.handleRename(responder, operationContext, request.text);
      }
      case "limit": {
        const value = request.number;
        if (value === undefined) return this.sendUsage(responder);
        return this.handleSimpleOp(responder, () =>
          operations.setLimit(operationContext, value),
        );
      }
      case "permit": {
        const userId = request.userId;
        if (userId === undefined) return this.sendUsage(responder);
        return this.handleSimpleOp(responder, () =>
          operations.permit(operationContext, [userId]),
        );
      }
      case "deny": {
        const userId = request.userId;
        if (userId === undefined) return this.sendUsage(responder);
        return this.handleSimpleOp(responder, () =>
          operations.deny(operationContext, [userId]),
        );
      }
      case "trust": {
        const userId = request.userId;
        if (userId === undefined) return this.sendUsage(responder);
        return this.handleSimpleOp(responder, () =>
          operations.toggleTrust(operationContext, [userId]),
        );
      }
      case "untrust": {
        const userId = request.userId;
        if (userId === undefined) return this.sendUsage(responder);
        return this.handleSimpleOp(responder, () =>
          operations.toggleTrust(operationContext, [userId]),
        );
      }
      case "kick": {
        const userId = request.userId;
        if (userId === undefined) return this.sendUsage(responder);
        return this.handleSimpleOp(responder, () =>
          operations.kick(operationContext, [userId]),
        );
      }
      case "transfer": {
        const userId = request.userId;
        if (userId === undefined) return this.sendUsage(responder);
        return this.handleSimpleOp(responder, () =>
          operations.transfer(operationContext, userId),
        );
      }
      case "bitrate": {
        const value = request.number;
        if (value === undefined) return this.sendUsage(responder);
        return this.handleSimpleOp(responder, () =>
          operations.setBitrate(operationContext, value),
        );
      }
      case "region": {
        const region = request.text;
        if (region === undefined) return this.sendUsage(responder);
        return this.handleSimpleOp(responder, () =>
          operations.setRegion(operationContext, region),
        );
      }
      case "reset":
        return this.handleSimpleOp(responder, () =>
          operations.reset(operationContext),
        );
      case "claim":
        return this.handleSimpleOp(responder, () =>
          operations.claim(operationContext, member.id, member.voice.channelId),
        );
      case "panel":
        return this.handlePanel(responder, operationContext);
      default:
        return responder.replyError("Unknown subcommand.");
    }
  }

  // ───── Generic operation handler ─────

  private async handleSimpleOp(
    responder: CommandResponder,
    operationFn: () => Promise<{ ok: boolean; message: string }>,
  ) {
    try {
      const result = await operationFn();
      const emoji = result.ok ? EMOJI.STATUS.SUCCESS : EMOJI.STATUS.ERROR;
      return responder.reply({
        content: `${emoji} ${result.message}`,
      });
    } catch (error) {
      this.container.logger.error(
        "[TempVoice] Command operation failed:",
        error,
      );
      return responder.reply({
        content: `${EMOJI.STATUS.ERROR} An unexpected error occurred. Please try again.`,
      });
    }
  }

  // ───── Lock/Unlock (directional, not toggle) ─────

  private async handleToggleLock(
    responder: CommandResponder,
    operationContext: OperationContext,
    wantLocked: boolean,
  ) {
    // If already in desired state, just confirm
    if (operationContext.tempChannel.isLocked === wantLocked) {
      return responder.reply({
        content: wantLocked
          ? `${EMOJI.CHANNELS.STATE.LOCKED} Channel is already locked.`
          : `${EMOJI.CHANNELS.STATE.UNLOCKED} Channel is already unlocked.`,
      });
    }

    // toggleLock will flip to the desired state since current != desired
    return this.handleSimpleOp(responder, () =>
      getTempVoiceServices().operations.toggleLock(operationContext),
    );
  }

  // ───── Hide/Show (directional, not toggle) ─────

  private async handleToggleHide(
    responder: CommandResponder,
    operationContext: OperationContext,
    wantHidden: boolean,
  ) {
    if (operationContext.tempChannel.isHidden === wantHidden) {
      return responder.reply({
        content: wantHidden
          ? `${EMOJI.UI.INDICATORS.HIDDEN} Channel is already hidden.`
          : `${EMOJI.UI.INDICATORS.VISIBILITY} Channel is already visible.`,
      });
    }

    return this.handleSimpleOp(responder, () =>
      getTempVoiceServices().operations.toggleHide(operationContext),
    );
  }

  // ───── Rename (with moderation) ─────

  private async handleRename(
    responder: CommandResponder,
    operationContext: OperationContext,
    newName: string,
  ) {
    if (!this.moderationService) {
      this.moderationService = new NameModerationService(
        this.container.prisma,
        this.container.logger,
      );
    }

    const { operations } = getTempVoiceServices();

    try {
      let finalName = newName;

      // Apply moderation if enabled
      if (operationContext.config.moderationEnabled) {
        const voiceChannel = await operationContext.guild.channels.fetch(
          operationContext.channelId,
          {
            force: true,
          },
        );
        if (!voiceChannel || !voiceChannel.isVoiceBased()) {
          return responder.reply({
            content: `${EMOJI.STATUS.ERROR} Voice channel not found.`,
          });
        }

        const oldName = voiceChannel.name;
        const moderationResult =
          await this.moderationService.moderateChannelName(
            voiceChannel as import("discord.js").VoiceChannel,
            oldName,
            newName,
            operationContext.config,
            responder.user.id,
          );

        if (moderationResult && !moderationResult.validation.isAllowed) {
          finalName = moderationResult.finalName;

          if (operationContext.config.moderationAction === "AUTO_RENAME") {
            await operations.rename(operationContext, finalName);
            return responder.reply({
              content: `${EMOJI.STATUS.WARNING} Your channel name was automatically changed to **${finalName}** because "${newName}" contains inappropriate content.`,
            });
          } else if (operationContext.config.moderationAction === "BLOCK") {
            return responder.reply({
              content: `${EMOJI.STATUS.ERROR} That channel name is not allowed. Please choose a different name.`,
            });
          }
        }

        // Mark as bot rename to prevent channelUpdate listener from re-processing
        this.moderationService.markAsBotRename(
          operationContext.channelId,
          finalName,
        );
      }

      const result = await operations.rename(operationContext, finalName);
      const emoji = result.ok ? EMOJI.STATUS.SUCCESS : EMOJI.STATUS.ERROR;
      return responder.reply({
        content: `${emoji} ${result.message}`,
      });
    } catch (error) {
      this.container.logger.error(
        "[TempVoice] Failed to rename channel:",
        error,
      );
      return responder.reply({
        content: `${EMOJI.STATUS.ERROR} Failed to rename channel. Please try again.`,
      });
    }
  }

  // ───── Panel ─────

  private async handlePanel(
    responder: CommandResponder,
    operationContext: OperationContext,
  ) {
    try {
      const result =
        await getTempVoiceServices().operations.reconcile(operationContext);

      return responder.reply({
        content: `${result.ok ? EMOJI.STATUS.SUCCESS : EMOJI.STATUS.ERROR} ${result.message}`,
      });
    } catch (error) {
      this.container.logger.error(
        "[TempVoice] Failed to send control panel:",
        error,
      );
      return responder.reply({
        content: `${EMOJI.STATUS.ERROR} Failed to send control panel. Please try again.`,
      });
    }
  }
}
