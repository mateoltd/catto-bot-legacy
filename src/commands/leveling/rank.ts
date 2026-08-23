/**
 * Rank command - Display user XP rank with a custom generated card
 */

import { Command } from '@sapphire/framework';
import { AttachmentBuilder, EmbedBuilder, Colors } from 'discord.js';
import { EMOJI } from '#lib/discord/design/index.js';
import { RankCardDataService } from '#modules/xp/services/rank-card-data.service.js';
import { leaderboardService } from '#root/modules/xp/xp-text/index.js';
import * as voiceLeaderboardService from '#root/modules/xp/xp-voice/index.js';
import { imageGenClient } from '#lib/services/image-gen-client.js';

export class RankCommand extends Command {
  private rankDataService: RankCardDataService;

  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'rank',
      description: "View your or another user's XP rank card",
    });

    this.rankDataService = new RankCardDataService(this.container.prisma);
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addSubcommand((subcommand) =>
          subcommand
            .setName('text')
            .setDescription('View text/message XP rank card')
            .addUserOption((option) =>
              option
                .setName('user')
                .setDescription('The user to view rank for (defaults to yourself)')
                .setRequired(false)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('voice')
            .setDescription('View voice XP rank card')
            .addUserOption((option) =>
              option
                .setName('user')
                .setDescription('The user to view rank for (defaults to yourself)')
                .setRequired(false)
            )
        )
    );
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await interaction.deferReply();

    // Ensure command is run in a guild
    if (!interaction.guild || !interaction.guildId) {
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} This command can only be used in a server.`,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user') || interaction.user;

    // Check if bot
    if (targetUser.bot) {
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} Bots don't earn XP!`,
      });
    }

    if (subcommand === 'voice') {
      return this.handleVoiceRank(interaction, targetUser, interaction.guildId);
    } else {
      return this.handleTextRank(interaction, targetUser, interaction.guildId);
    }
  }

  /**
   * Handle text/message XP rank card
   */
  private async handleTextRank(
    interaction: Command.ChatInputCommandInteraction,
    targetUser: NonNullable<ReturnType<typeof interaction.options.getUser>>,
    guildId: string
  ) {
    try {
      // Get user stats
      const stats = await leaderboardService.getUserStats(guildId, targetUser.id);

      if (!stats) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} ${targetUser.id === interaction.user.id ? 'You have' : 'This user has'} not earned any XP yet. Start chatting to earn XP!`,
        });
      }

      // Get total members for context
      const totalMembers = await leaderboardService.getTotalUsers(guildId);

      // Calculate XP needed for next level
      const xpNeededForNextLevel = stats.nextLevelXp - stats.currentLevelXp;
      const xpInCurrentLevel = stats.xp - stats.currentLevelXp;

      // Get user avatar
      const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });

      // Determine accent color based on level
      const accentColor = this.rankDataService.getLevelColor(stats.level);

      // Fetch detailed XP breakdown data
      const xpBreakdown = await this.rankDataService.getTextXPBreakdown(guildId, targetUser.id);
      const activityData = await this.rankDataService.getTextActivityData(guildId, targetUser.id);

      // Get member join date
      const memberSince = await this.rankDataService.getMemberSince(guildId, targetUser.id);

      // Generate rank card
      const cardImage = await imageGenClient.generateRankCard({
        username: targetUser.username,
        avatarUrl: avatarUrl,
        level: stats.level,
        currentXP: xpInCurrentLevel,
        requiredXP: xpNeededForNextLevel,
        rank: stats.rank ?? 0,
        totalMembers: totalMembers,
        accentColor: accentColor,
        messagesXP: xpBreakdown.messagesXP,
        voiceXP: xpBreakdown.voiceXP,
        reactionsXP: xpBreakdown.reactionsXP,
        commandsXP: xpBreakdown.commandsXP,
        mostActiveChannel: activityData.mostActiveChannel,
        last7DaysXP: activityData.last7DaysXP,
        last30DaysXP: activityData.last30DaysXP,
        streak: activityData.streak,
        memberSince: memberSince,
      });

      // Create attachment
      const attachment = new AttachmentBuilder(cardImage, { name: 'rank-card.png' });

      // Send the image
      return interaction.editReply({
        files: [attachment],
      });
    } catch (error) {
      this.container.logger.error('Error generating rank card:', error);

      // Fallback to text-based embed
      const stats = await leaderboardService.getUserStats(guildId, targetUser.id);

      if (!stats) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} Failed to retrieve user stats.`,
        });
      }

      const totalMembers = await leaderboardService.getTotalUsers(guildId);
      const xpNeededForNextLevel = stats.nextLevelXp - stats.currentLevelXp;
      const xpInCurrentLevel = stats.xp - stats.currentLevelXp;

      const embed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setAuthor({
          name: `${targetUser.username}'s Rank`,
          iconURL: targetUser.displayAvatarURL(),
        })
        .setDescription(
          `🎯 **Level ${stats.level}**\n` +
            `✨ **${stats.xp.toLocaleString()}** Total XP\n` +
            `📊 **Rank #${stats.rank ?? 'N/A'}** of ${totalMembers}`
        )
        .addFields({
          name: 'Progress to Next Level',
          value: `${xpInCurrentLevel.toLocaleString()} / ${xpNeededForNextLevel.toLocaleString()} XP (${stats.progress.toFixed(1)}%)`,
        })
        .setFooter({ text: 'Card generation failed, showing text-based stats' })
        .setTimestamp();

      return interaction.editReply({
        embeds: [embed],
        content: `${EMOJI.STATUS.WARNING} Image generation failed, showing text-based stats instead.`,
      });
    }
  }

  /**
   * Handle voice XP rank card
   */
  private async handleVoiceRank(
    interaction: Command.ChatInputCommandInteraction,
    targetUser: NonNullable<ReturnType<typeof interaction.options.getUser>>,
    guildId: string
  ) {
    try {
      // Get voice stats
      const stats = await voiceLeaderboardService.getVoiceUserStats(guildId, targetUser.id);

      if (!stats) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} ${targetUser.id === interaction.user.id ? 'You have' : 'This user has'} not earned any voice XP yet. Join voice channels to earn voice XP!`,
        });
      }

      // Get total members for context
      const totalMembers = await voiceLeaderboardService.getVoiceUserCount(guildId);

      // Calculate XP needed for next level
      const xpNeededForNextLevel = stats.nextLevelXp - stats.currentLevelXp;
      const xpInCurrentLevel = stats.xp - stats.currentLevelXp;

      // Get user avatar
      const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });

      // Determine accent color based on level
      const accentColor = this.rankDataService.getLevelColor(stats.level);

      // Fetch detailed voice XP breakdown data
      const voiceBreakdown = await this.rankDataService.getVoiceXPBreakdown(guildId, targetUser.id);
      const voiceActivityData = await this.rankDataService.getVoiceActivityData(
        guildId,
        targetUser.id
      );

      // Get member join date
      const memberSince = await this.rankDataService.getMemberSince(guildId, targetUser.id);

      // Generate rank card
      const cardImage = await imageGenClient.generateRankCard({
        username: targetUser.username,
        avatarUrl: avatarUrl,
        level: stats.level,
        currentXP: xpInCurrentLevel,
        requiredXP: xpNeededForNextLevel,
        rank: stats.rank ?? 0,
        totalMembers: totalMembers,
        accentColor: accentColor,
        messagesXP: voiceBreakdown.totalTimeXP,
        voiceXP: voiceBreakdown.streamingXP,
        reactionsXP: voiceBreakdown.videoXP,
        commandsXP: voiceBreakdown.regularXP,
        mostActiveChannel: voiceActivityData.mostActiveChannel,
        last7DaysXP: voiceActivityData.last7DaysMinutes,
        last30DaysXP: voiceActivityData.last30DaysMinutes,
        streak: voiceActivityData.streak,
        memberSince: memberSince,
        // Voice-specific labels
        isVoiceCard: true,
      });

      // Create attachment
      const attachment = new AttachmentBuilder(cardImage, { name: 'voice-rank-card.png' });

      // Send the image
      return interaction.editReply({
        files: [attachment],
      });
    } catch (error) {
      this.container.logger.error('Error generating voice rank card:', error);

      // Fallback to text-based embed
      const stats = await voiceLeaderboardService.getVoiceUserStats(guildId, targetUser.id);

      if (!stats) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} Failed to retrieve voice stats.`,
        });
      }

      const totalMembers = await this.container.prisma.userVoiceXP.count({
        where: { guildId },
      });
      const xpNeededForNextLevel = stats.nextLevelXp - stats.currentLevelXp;
      const xpInCurrentLevel = stats.xp - stats.currentLevelXp;

      const embed = new EmbedBuilder()
        .setColor(Colors.Purple)
        .setAuthor({
          name: `${targetUser.username}'s Voice Rank`,
          iconURL: targetUser.displayAvatarURL(),
        })
        .setDescription(
          `🎙️ **Level ${stats.level}**\n` +
            `✨ **${stats.xp.toLocaleString()}** Total Voice XP\n` +
            `⏱️ **${stats.minutesInVoice.toLocaleString()}** minutes in voice\n` +
            `📊 **Rank #${stats.rank ?? 'N/A'}** of ${totalMembers}`
        )
        .addFields({
          name: 'Progress to Next Level',
          value: `${xpInCurrentLevel.toLocaleString()} / ${xpNeededForNextLevel.toLocaleString()} XP (${stats.progress.toFixed(1)}%)`,
        })
        .setFooter({ text: 'Card generation failed, showing text-based stats' })
        .setTimestamp();

      return interaction.editReply({
        embeds: [embed],
        content: `${EMOJI.STATUS.WARNING} Image generation failed, showing text-based stats instead.`,
      });
    }
  }
}
