/**
 * Reputation command - View reputation stats, history, and leaderboard
 */

import { Subcommand } from '@sapphire/plugin-subcommands';
import { EmbedBuilder, Colors } from 'discord.js';
import { EMOJI } from '#lib/discord/design/index.js';
import { ReputationService } from '#modules/reputation/services/reputation.service.js';
import { REPUTATION_TIERS, ReputationTier } from '#modules/reputation/models/reputation.model.js';
import type { UserReputation } from '@prisma/client';

export class ReputationCommand extends Subcommand {
  private reputationService!: ReputationService;

  public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
    super(context, {
      ...options,
      name: 'reputation',
      description: 'View reputation information',
      subcommands: [
        {
          name: 'view',
          chatInputRun: 'chatInputView',
        },
        {
          name: 'history',
          chatInputRun: 'chatInputHistory',
        },
        {
          name: 'leaderboard',
          chatInputRun: 'chatInputLeaderboard',
        },
        {
          name: 'tiers',
          chatInputRun: 'chatInputTiers',
        },
      ],
    });
  }

  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addSubcommand((subcommand) =>
          subcommand
            .setName('view')
            .setDescription("View your or someone else's reputation")
            .addUserOption((option) =>
              option
                .setName('user')
                .setDescription('The user to view (leave empty for yourself)')
                .setRequired(false)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('history')
            .setDescription('View vouch history')
            .addUserOption((option) =>
              option
                .setName('user')
                .setDescription('The user to view history for')
                .setRequired(false)
            )
            .addStringOption((option) =>
              option
                .setName('type')
                .setDescription('View received or given vouches')
                .addChoices(
                  { name: 'Received', value: 'received' },
                  { name: 'Given', value: 'given' }
                )
                .setRequired(false)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand.setName('leaderboard').setDescription('View the reputation leaderboard')
        )
        .addSubcommand((subcommand) =>
          subcommand.setName('tiers').setDescription('View all reputation tiers and their perks')
        )
    );
  }

  public async chatInputView(interaction: Subcommand.ChatInputCommandInteraction) {
    // Initialize service
    if (!this.reputationService) {
      this.reputationService = new ReputationService(this.container.prisma);
    }

    await interaction.deferReply();

    if (!interaction.guildId) {
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} This command can only be used in a server.`,
      });
    }

    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const isOwn = targetUser.id === interaction.user.id;

    try {
      const stats = await this.reputationService.getReputationStats(guildId, targetUser.id);

      const tierInfo = REPUTATION_TIERS[stats.currentTier];

      const embed = new EmbedBuilder()
        .setColor(tierInfo.color)
        .setAuthor({
          name: `${targetUser.username}'s Reputation`,
          iconURL: targetUser.displayAvatarURL(),
        })
        .setDescription(
          `${tierInfo.emoji} **${stats.currentTier} Tier**\n${EMOJI.XP.REPUTATION.VOUCH_TYPES.SKILLED} ${stats.reputationScore} reputation points`
        )
        .addFields(
          {
            name: 'Vouches',
            value: `${EMOJI.MISC.INBOX} Received: ${stats.vouchesReceived}\n${EMOJI.MISC.OUTBOX} Given: ${stats.vouchesGiven}`,
            inline: true,
          },
          {
            name: 'Breakdown',
            value: `${EMOJI.XP.REPUTATION.VOUCH_TYPES.HELPFUL} Helpful: ${stats.breakdown.helpful}\n${EMOJI.XP.REPUTATION.VOUCH_TYPES.FRIENDLY} Friendly: ${stats.breakdown.friendly}\n${EMOJI.XP.REPUTATION.VOUCH_TYPES.SKILLED} Skilled: ${stats.breakdown.skilled}\n${EMOJI.XP.REPUTATION.VOUCH_TYPES.RELIABLE} Reliable: ${stats.breakdown.reliable}`,
            inline: true,
          }
        )
        .setFooter({ text: `Use /rep to give reputation to ${isOwn ? 'others' : 'this user'}` })
        .setTimestamp();

      // Add next tier info
      if (stats.nextTier) {
        const nextTierInfo = REPUTATION_TIERS[stats.nextTier];
        const pointsNeeded = nextTierInfo.minScore - stats.reputationScore;
        embed.addFields({
          name: `Next Tier: ${nextTierInfo.emoji} ${stats.nextTier}`,
          value: `Progress: ${stats.progressToNextTier}%\n${this.createProgressBar(stats.progressToNextTier)}\n${pointsNeeded} points needed`,
          inline: false,
        });
      } else {
        embed.addFields({
          name: `${EMOJI.REWARDS.CROWN} Maximum Tier Reached!`,
          value: "You've achieved the highest reputation tier!",
          inline: false,
        });
      }

      // Add current perks
      embed.addFields({
        name: 'Current Perks',
        value: tierInfo.perks.map((perk) => `• ${perk}`).join('\n'),
        inline: false,
      });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error('Failed to get reputation stats:', error);
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} Failed to retrieve reputation information.`,
      });
    }
  }

  public async chatInputHistory(interaction: Subcommand.ChatInputCommandInteraction) {
    // Initialize service
    if (!this.reputationService) {
      this.reputationService = new ReputationService(this.container.prisma);
    }

    await interaction.deferReply();

    if (!interaction.guildId) {
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} This command can only be used in a server.`,
      });
    }

    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const historyType =
      (interaction.options.getString('type') as 'received' | 'given') || 'received';

    try {
      const history = await this.reputationService.getVouchHistory(
        guildId,
        targetUser.id,
        historyType
      );

      if (history.length === 0) {
        return interaction.editReply({
          content: `${targetUser.username} has no ${historyType} vouches yet.`,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle(
          `${targetUser.username}'s ${historyType === 'received' ? 'Received' : 'Given'} Vouches`
        )
        .setDescription(`Showing the last ${history.length} vouches`)
        .setTimestamp();

      for (const vouch of history.slice(0, 10)) {
        const otherUserId = historyType === 'received' ? vouch.giverUserId : vouch.receiverUserId;
        const emoji = this.getVouchEmoji(vouch.vouchType);
        const timestamp = `<t:${Math.floor(vouch.createdAt.getTime() / 1000)}:R>`;

        embed.addFields({
          name: `${emoji} ${vouch.vouchType} • ${timestamp}`,
          value: `${historyType === 'received' ? 'From' : 'To'}: <@${otherUserId}>\n${
            vouch.reason ? `*"${vouch.reason}"*` : '*No reason provided*'
          }`,
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error('Failed to get vouch history:', error);
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} Failed to retrieve vouch history.`,
      });
    }
  }

  public async chatInputLeaderboard(interaction: Subcommand.ChatInputCommandInteraction) {
    // Initialize service
    if (!this.reputationService) {
      this.reputationService = new ReputationService(this.container.prisma);
    }

    await interaction.deferReply();

    if (!interaction.guildId) {
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} This command can only be used in a server.`,
      });
    }

    const guildId = interaction.guildId;

    try {
      const leaderboard = await this.reputationService.getLeaderboard(guildId, 10);

      if (leaderboard.length === 0) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} No reputation data available yet.`,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.Gold)
        .setTitle(`${EMOJI.REWARDS.TROPHY} Reputation Leaderboard`)
        .setDescription('Top 10 most reputable members')
        .setTimestamp();

      const medals = [
        EMOJI.REWARDS.MEDALS.GOLD,
        EMOJI.REWARDS.MEDALS.SILVER,
        EMOJI.REWARDS.MEDALS.BRONZE,
      ];
      const leaderboardText = leaderboard
        .map((entry: UserReputation, index: number) => {
          const medal = medals[index] || `**${index + 1}.**`;
          const tierInfo = REPUTATION_TIERS[entry.reputationTier as ReputationTier];
          return `${medal} <@${entry.userId}> - ${tierInfo.emoji} ${entry.reputationScore} pts (${entry.vouchesReceived} vouches)`;
        })
        .join('\n');

      embed.addFields({
        name: 'Rankings',
        value: leaderboardText,
        inline: false,
      });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error('Failed to get leaderboard:', error);
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} Failed to retrieve leaderboard.`,
      });
    }
  }

  public async chatInputTiers(interaction: Subcommand.ChatInputCommandInteraction) {
    await interaction.deferReply();

    const embed = new EmbedBuilder()
      .setColor(Colors.Purple)
      .setTitle(`${EMOJI.XP.GAIN} Reputation Tiers`)
      .setDescription('Build your reputation to unlock amazing perks!')
      .setTimestamp();

    // Add each tier
    for (const [tierName, tierInfo] of Object.entries(REPUTATION_TIERS)) {
      embed.addFields({
        name: `${tierInfo.emoji} ${tierName}`,
        value: `**${tierInfo.minScore}+ points**\n${tierInfo.perks.map((perk) => `• ${perk}`).join('\n')}`,
        inline: false,
      });
    }

    embed.setFooter({ text: 'Use /rep to help others gain reputation!' });

    return interaction.editReply({ embeds: [embed] });
  }

  private getVouchEmoji(type: string): string {
    switch (type) {
      case 'helpful':
        return EMOJI.XP.REPUTATION.VOUCH_TYPES.HELPFUL;
      case 'friendly':
        return EMOJI.XP.REPUTATION.VOUCH_TYPES.FRIENDLY;
      case 'skilled':
        return EMOJI.XP.REPUTATION.VOUCH_TYPES.SKILLED;
      case 'reliable':
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
