/**
 * Vouch command - Allow users to vouch for each other
 */

import { Args, Command } from '@sapphire/framework';
import { EmbedBuilder, Colors, type Message, type User } from 'discord.js';
import { EMOJI } from '#lib/discord/design/index.js';
import {
  InteractionResponder,
  MessageResponder,
  type CommandResponder,
} from '#lib/discord/index.js';
import { readPrefixArgs, resolvePrefixUser } from '#lib/interaction/prefixArgs.js';
import { ReputationService } from '#modules/reputation/services/reputation.service.js';
import { VouchType, REPUTATION_TIERS } from '#modules/reputation/models/reputation.model.js';

export class VouchCommand extends Command {
  private reputationService!: ReputationService;

  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'rep',
      description: 'Give reputation to another member to increase their standing',
      preconditions: ['GuildOnly'],
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user you want to give reputation to')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('What type of reputation is this?')
            .setRequired(true)
            .addChoices(
              {
                name: `${EMOJI.XP.REPUTATION.VOUCH_TYPES.HELPFUL} Helpful - They helped you or others`,
                value: VouchType.HELPFUL,
              },
              {
                name: `${EMOJI.XP.REPUTATION.VOUCH_TYPES.FRIENDLY} Friendly - They're welcoming and positive`,
                value: VouchType.FRIENDLY,
              },
              {
                name: `${EMOJI.XP.REPUTATION.VOUCH_TYPES.SKILLED} Skilled - They're knowledgeable/talented`,
                value: VouchType.SKILLED,
              },
              {
                name: `${EMOJI.XP.REPUTATION.VOUCH_TYPES.RELIABLE} Reliable - They're dependable and trustworthy`,
                value: VouchType.RELIABLE,
              }
            )
        )
        .addStringOption((option) =>
          option
            .setName('reason')
            .setDescription('Why are you giving them reputation? (optional)')
            .setMaxLength(200)
            .setRequired(false)
        )
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    return this.run(
      interaction.options.getUser('user', true),
      interaction.options.getString('type', true) as VouchType,
      interaction.options.getString('reason'),
      new InteractionResponder(interaction)
    );
  }

  public override async messageRun(message: Message, args: Args) {
    const guildMessage = message as Message<true>;
    const values = await readPrefixArgs(args);
    const responder = new MessageResponder(guildMessage);
    const targetUser = values[0] ? await resolvePrefixUser(guildMessage, values[0]) : null;
    const vouchType = values[1]?.toLocaleLowerCase() as VouchType | undefined;
    const reason = values.slice(2).join(' ') || null;

    if (
      !targetUser ||
      !Object.values(VouchType).includes(vouchType as VouchType) ||
      (reason?.length ?? 0) > 200
    ) {
      await responder.replyError(
        'Usage: `rep <user> <helpful|friendly|skilled|reliable> [reason]`'
      );
      return;
    }

    return this.run(targetUser, vouchType as VouchType, reason, responder);
  }

  private async run(
    targetUser: User,
    vouchType: VouchType,
    reason: string | null,
    ctx: CommandResponder
  ) {
    // Initialize service
    if (!this.reputationService) {
      this.reputationService = new ReputationService(this.container.prisma);
    }

    await ctx.deferPublicClassic();

    const { guild } = ctx;
    const guildId = guild.id;

    // Get guild member objects
    const giver = await guild.members.fetch(ctx.user.id);
    const receiver = await guild.members.fetch(targetUser.id);

    // Validate vouch
    const validation = await this.reputationService.validateVouch(
      guild,
      giver,
      receiver,
      vouchType
    );

    if (!validation.isValid) {
      return ctx.editReply({
        content: validation.reason,
      });
    }

    // Submit vouch
    try {
      await this.reputationService.submitVouch(guildId, {
        giverUserId: ctx.user.id,
        receiverUserId: targetUser.id,
        vouchType,
        reason: reason || undefined,
        contextType: 'text',
        contextId: ctx.channelId,
      });

      // Get updated stats
      const stats = await this.reputationService.getReputationStats(guildId, targetUser.id);

      const tierInfo = REPUTATION_TIERS[stats.currentTier];
      const vouchEmoji = this.getVouchEmoji(vouchType);

      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle(`${EMOJI.STATUS.SUCCESS} Reputation Given!`)
        .setDescription(
          `${vouchEmoji} You gave reputation to ${targetUser} as **${vouchType}**!${
            reason ? `\n\n*"${reason}"*` : ''
          }`
        )
        .addFields(
          {
            name: 'Their Reputation',
            value: `${tierInfo.emoji} **${stats.currentTier}** Tier\n${EMOJI.XP.REPUTATION.VOUCH_TYPES.SKILLED} ${stats.reputationScore} points`,
            inline: true,
          },
          {
            name: 'Total Vouches',
            value: `${stats.vouchesReceived} received\n${stats.vouchesGiven} given`,
            inline: true,
          }
        )
        .setFooter({ text: 'Reputation helps build trust in the community' })
        .setTimestamp();

      // Add next tier progress if applicable
      if (stats.nextTier) {
        const nextTierInfo = REPUTATION_TIERS[stats.nextTier];
        embed.addFields({
          name: 'Next Tier Progress',
          value: `${nextTierInfo.emoji} ${stats.nextTier}: ${stats.progressToNextTier}%\n${this.createProgressBar(stats.progressToNextTier)}`,
          inline: false,
        });
      }

      return ctx.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error('Failed to submit vouch:', error);
      return ctx.editReply({
        content: `${EMOJI.STATUS.ERROR} Failed to submit vouch. Please try again later.`,
      });
    }
  }

  private getVouchEmoji(type: VouchType): string {
    switch (type) {
      case VouchType.HELPFUL:
        return EMOJI.XP.REPUTATION.VOUCH_TYPES.HELPFUL;
      case VouchType.FRIENDLY:
        return EMOJI.XP.REPUTATION.VOUCH_TYPES.FRIENDLY;
      case VouchType.SKILLED:
        return EMOJI.XP.REPUTATION.VOUCH_TYPES.SKILLED;
      case VouchType.RELIABLE:
        return EMOJI.XP.REPUTATION.VOUCH_TYPES.RELIABLE;
      default:
        return EMOJI.XP.REPUTATION.VOUCH_TYPES.DEFAULT;
    }
  }

  private createProgressBar(percentage: number, length: number = 10): string {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return EMOJI.XP.BAR.FILLED.repeat(filled) + EMOJI.XP.BAR.EMPTY.repeat(empty);
  }
}
