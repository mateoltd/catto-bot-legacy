/**
 * Leaderboard command - Display guild XP leaderboard with a custom generated card
 */

import { Args, Command } from '@sapphire/framework';
import { AttachmentBuilder, EmbedBuilder, Colors, type Message } from 'discord.js';
import { EMOJI } from '#lib/discord/design/index.js';
import {
  InteractionResponder,
  MessageResponder,
  type CommandResponder,
} from '#lib/discord/index.js';
import { readPrefixArgs } from '#lib/interaction/prefixArgs.js';
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
      preconditions: ['GuildOnly'],
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

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const limit = interaction.options.getInteger('limit') || 10;
    return this.run(subcommand, limit, new InteractionResponder(interaction));
  }

  public override async messageRun(message: Message, args: Args) {
    const values = await readPrefixArgs(args);
    const first = values[0]?.toLocaleLowerCase();
    const subcommand = first === 'voice' || first === 'text' ? first : 'text';
    const limitRaw = first === 'voice' || first === 'text' ? values[1] : values[0];
    const maxArgs = first === 'voice' || first === 'text' ? 2 : 1;
    const limit = limitRaw === undefined ? 10 : Number(limitRaw);
    const responder = new MessageResponder(message as Message<true>);

    if (!Number.isInteger(limit) || limit < 5 || limit > 25 || values.length > maxArgs) {
      await responder.replyError(
        'Limit must be a whole number from 5 to 25. Usage: `leaderboard [text|voice] [limit]`'
      );
      return;
    }

    return this.run(subcommand, limit, responder);
  }

  private async run(subcommand: string, limit: number, ctx: CommandResponder) {
    await ctx.deferPublicClassic();

    if (subcommand === 'voice') {
      return this.handleVoiceLeaderboard(ctx, limit);
    } else {
      return this.handleTextLeaderboard(ctx, limit);
    }
  }

  private async handleTextLeaderboard(ctx: CommandResponder, limit: number) {
    const { guild } = ctx;
    const guildId = guild.id;

    try {
      // Get leaderboard data
      const leaderboardData = await leaderboardService.getLeaderboard(guildId, limit, 0);

      if (leaderboardData.users.length === 0) {
        return ctx.editReply({
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
      const attachment = new AttachmentBuilder(cardImage, {
        name: 'text-leaderboard.png',
      });

      // Send the image
      return ctx.editReply({
        files: [attachment],
      });
    } catch (error) {
      this.container.logger.error('Error generating text leaderboard card:', error);

      // Fallback to text-based embed
      const leaderboardData = await leaderboardService.getLeaderboard(guildId, limit, 0);

      if (leaderboardData.users.length === 0) {
        return ctx.editReply({
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
        .setFooter({
          text: 'Image generation failed, showing text-based leaderboard',
        })
        .setTimestamp();

      const iconURL = guild.iconURL();
      if (iconURL) {
        embed.setThumbnail(iconURL);
      }

      return ctx.editReply({
        embeds: [embed],
        content: `${EMOJI.STATUS.WARNING} Image generation failed, showing text-based leaderboard instead.`,
      });
    }
  }

  private async handleVoiceLeaderboard(ctx: CommandResponder, limit: number) {
    const { guild } = ctx;
    const guildId = guild.id;

    try {
      // Get voice leaderboard data
      const leaderboardData = await voiceLeaderboardService.getVoiceLeaderboard(guildId, limit, 0);

      if (leaderboardData.users.length === 0) {
        return ctx.editReply({
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
      const attachment = new AttachmentBuilder(cardImage, {
        name: 'voice-leaderboard.png',
      });

      // Send the image
      return ctx.editReply({
        files: [attachment],
      });
    } catch (error) {
      this.container.logger.error('Error generating voice leaderboard card:', error);

      // Fallback to text-based embed
      const leaderboardData = await voiceLeaderboardService.getVoiceLeaderboard(guildId, limit, 0);

      if (leaderboardData.users.length === 0) {
        return ctx.editReply({
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
        .setFooter({
          text: 'Image generation failed, showing text-based leaderboard',
        })
        .setTimestamp();

      const iconURL = guild.iconURL();
      if (iconURL) {
        embed.setThumbnail(iconURL);
      }

      return ctx.editReply({
        embeds: [embed],
        content: `${EMOJI.STATUS.WARNING} Image generation failed, showing text-based leaderboard instead.`,
      });
    }
  }
}
