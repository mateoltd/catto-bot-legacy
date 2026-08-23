/**
 * Leaderboard command - Display guild XP leaderboard with a custom generated card
 */

import { Command } from '@sapphire/framework';
import { AttachmentBuilder, EmbedBuilder, Colors } from 'discord.js';
import { EMOJI } from '#lib/discord/design/index.js';
import { imageGenClient } from '#lib/services/image-gen-client.js';
import * as leaderboardService from '#root/modules/xp/xp-text/services/xp-text-leaderboard.service.js';
import * as voiceLeaderboardService from '#root/modules/xp/xp-voice/services/voice-xp-leaderboard.service.js';

export class LeaderboardCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'leaderboard',
      description: 'View the server XP leaderboard',
      aliases: ['lb', 'top'],
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addSubcommand((subcommand) =>
          subcommand
            .setName('text')
            .setDescription('View text/message XP leaderboard')
            .addIntegerOption((option) =>
              option
                .setName('limit')
                .setDescription('Number of users to show (default: 10, max: 25)')
                .setMinValue(5)
                .setMaxValue(25)
                .setRequired(false)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('voice')
            .setDescription('View voice XP leaderboard')
            .addIntegerOption((option) =>
              option
                .setName('limit')
                .setDescription('Number of users to show (default: 10, max: 25)')
                .setMinValue(5)
                .setMaxValue(25)
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
    const limit = interaction.options.getInteger('limit') || 10;

    if (subcommand === 'voice') {
      return this.handleVoiceLeaderboard(interaction, limit);
    } else {
      return this.handleTextLeaderboard(interaction, limit);
    }
  }

  private async handleTextLeaderboard(
    interaction: Command.ChatInputCommandInteraction,
    limit: number
  ) {
    const guildId = interaction.guildId as string;
    const guild = interaction.guild as NonNullable<typeof interaction.guild>;

    try {
      // Get leaderboard data
      const leaderboardData = await leaderboardService.getLeaderboard(guildId, limit, 0);

      if (leaderboardData.users.length === 0) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} No users have earned XP yet!`,
        });
      }

      // Prepare data for image generation
      const entries = leaderboardData.users.map((user) => ({
        rank: user.rank,
        username: user.username,
        avatarUrl: user.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png',
        level: user.level,
        xp: user.xp,
      }));

      // Calculate total XP from entries
      const totalXp = entries.reduce((sum, entry) => sum + entry.xp, 0);

      // Get weekly XP
      const weeklyXp = await leaderboardService.getWeeklyXP(guildId);

      // Generate leaderboard card
      const cardImage = await imageGenClient.generateLeaderboard({
        guildName: guild.name,
        guildIcon: guild.iconURL({ extension: 'png', size: 128 }) || undefined,
        entries: entries,
        accentColor: '#5865F2',
        totalMembers: leaderboardData.total || entries.length,
        totalXp: totalXp,
        weeklyXp: weeklyXp,
      });

      // Create attachment
      const attachment = new AttachmentBuilder(cardImage, { name: 'text-leaderboard.png' });

      // Send the image
      return interaction.editReply({
        files: [attachment],
      });
    } catch (error) {
      this.container.logger.error('Error generating text leaderboard card:', error);

      // Fallback to text-based embed
      const leaderboardData = await leaderboardService.getLeaderboard(guildId, limit, 0);

      if (leaderboardData.users.length === 0) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} No users have earned XP yet!`,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setTitle(`🏆 ${guild.name} - Text XP Leaderboard`)
        .setDescription(
          leaderboardData.users
            .map((user, index) => {
              const medal =
                index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${user.rank}.**`;
              return `${medal} <@${user.userId}> - Level ${user.level} (${user.xp.toLocaleString()} XP)`;
            })
            .join('\n')
        )
        .setFooter({ text: 'Image generation failed, showing text-based leaderboard' })
        .setTimestamp();

      const iconURL = guild.iconURL();
      if (iconURL) {
        embed.setThumbnail(iconURL);
      }

      return interaction.editReply({
        embeds: [embed],
        content: `${EMOJI.STATUS.WARNING} Image generation failed, showing text-based leaderboard instead.`,
      });
    }
  }

  private async handleVoiceLeaderboard(
    interaction: Command.ChatInputCommandInteraction,
    limit: number
  ) {
    const guildId = interaction.guildId as string;
    const guild = interaction.guild as NonNullable<typeof interaction.guild>;

    try {
      // Get voice leaderboard data
      const leaderboardData = await voiceLeaderboardService.getVoiceLeaderboard(guildId, limit, 0);

      if (leaderboardData.users.length === 0) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} No users have earned voice XP yet!`,
        });
      }

      // Prepare data for image generation
      const entries = leaderboardData.users.map((user) => ({
        rank: user.rank,
        username: user.username,
        avatarUrl: user.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png',
        level: user.level,
        xp: user.xp,
      }));

      // Calculate total XP from entries
      const totalXp = entries.reduce((sum, entry) => sum + entry.xp, 0);

      // Get weekly voice XP
      const weeklyXp = await voiceLeaderboardService.getWeeklyVoiceXP(guildId);

      // Generate leaderboard card
      const cardImage = await imageGenClient.generateLeaderboard({
        guildName: guild.name,
        guildIcon: guild.iconURL({ extension: 'png', size: 128 }) || undefined,
        entries: entries,
        accentColor: '#9B59B6', // Purple for voice
        totalMembers: leaderboardData.total || entries.length,
        totalXp: totalXp,
        weeklyXp: weeklyXp,
      });

      // Create attachment
      const attachment = new AttachmentBuilder(cardImage, { name: 'voice-leaderboard.png' });

      // Send the image
      return interaction.editReply({
        files: [attachment],
      });
    } catch (error) {
      this.container.logger.error('Error generating voice leaderboard card:', error);

      // Fallback to text-based embed
      const leaderboardData = await voiceLeaderboardService.getVoiceLeaderboard(guildId, limit, 0);

      if (leaderboardData.users.length === 0) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} No users have earned voice XP yet!`,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.Purple)
        .setTitle(`🎙️ ${guild.name} - Voice XP Leaderboard`)
        .setDescription(
          leaderboardData.users
            .map((user, index) => {
              const medal =
                index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${user.rank}.**`;
              return `${medal} <@${user.userId}> - Level ${user.level} (${user.xp.toLocaleString()} XP, ${user.minutesInVoice} min)`;
            })
            .join('\n')
        )
        .setFooter({ text: 'Image generation failed, showing text-based leaderboard' })
        .setTimestamp();

      const iconURL = guild.iconURL();
      if (iconURL) {
        embed.setThumbnail(iconURL);
      }

      return interaction.editReply({
        embeds: [embed],
        content: `${EMOJI.STATUS.WARNING} Image generation failed, showing text-based leaderboard instead.`,
      });
    }
  }
}
