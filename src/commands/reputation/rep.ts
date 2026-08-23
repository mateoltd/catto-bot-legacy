/**
 * Vouch command - Allow users to vouch for each other
 */

import { Command } from '@sapphire/framework';
import { EmbedBuilder, Colors } from 'discord.js';
import { EMOJI } from '#lib/discord/design/index.js';
import { ReputationService } from '#modules/reputation/services/reputation.service.js';
import { VouchType, REPUTATION_TIERS } from '#modules/reputation/models/reputation.model.js';

export class VouchCommand extends Command {
  private reputationService!: ReputationService;

  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'rep',
      description: 'Give reputation to another member to increase their standing',
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

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    // Initialize service
    if (!this.reputationService) {
      this.reputationService = new ReputationService(this.container.prisma);
    }

    await interaction.deferReply();

    // Ensure command is run in a guild
    if (!interaction.guild || !interaction.guildId) {
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} This command can only be used in a server.`,
      });
    }

    const guild = interaction.guild;
    const guildId = interaction.guildId;

    const targetUser = interaction.options.getUser('user', true);
    const vouchType = interaction.options.getString('type', true) as VouchType;
    const reason = interaction.options.getString('reason');

    // Get guild member objects
    const giver = await guild.members.fetch(interaction.user.id);
    const receiver = await guild.members.fetch(targetUser.id);

    // Validate vouch
    const validation = await this.reputationService.validateVouch(
      guild,
      giver,
      receiver,
      vouchType
    );

    if (!validation.isValid) {
      return interaction.editReply({
        content: validation.reason,
      });
    }

    // Submit vouch
    try {
      await this.reputationService.submitVouch(guildId, {
        giverUserId: interaction.user.id,
        receiverUserId: targetUser.id,
        vouchType,
        reason: reason || undefined,
        contextType: 'text',
        contextId: interaction.channelId,
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

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error('Failed to submit vouch:', error);
      return interaction.editReply({
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
