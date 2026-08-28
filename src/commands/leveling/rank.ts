/**
 * Rank command - Display user XP rank with a custom generated card
 */

import { Args, Command } from '@sapphire/framework';
import { AttachmentBuilder, EmbedBuilder, Colors, type Message, type User } from 'discord.js';
import { EMOJI } from '#lib/discord/design/index.js';
import {
  InteractionResponder,
  MessageResponder,
  type CommandResponder,
} from '#lib/discord/index.js';
import { readPrefixArgs, resolvePrefixUser } from '#lib/interaction/prefixArgs.js';
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
      preconditions: ['GuildOnly'],
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

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user') || interaction.user;
    return this.run(subcommand, targetUser, new InteractionResponder(interaction));
  }

  public override async messageRun(message: Message, args: Args) {
    const guildMessage = message as Message<true>;
    const values = await readPrefixArgs(args);
    const first = values[0]?.toLocaleLowerCase();
    const subcommand = first === 'voice' || first === 'text' ? first : 'text';
    const userArg = first === 'voice' || first === 'text' ? values[1] : values[0];
    const maxArgs = first === 'voice' || first === 'text' ? 2 : 1;
    const targetUser = userArg
      ? await resolvePrefixUser(guildMessage, userArg)
      : guildMessage.author;

    if (!targetUser || values.length > maxArgs) {
      await new MessageResponder(guildMessage).replyError(
        `Could not find user \`${userArg}\`. Usage: \`rank [text|voice] [user]\``
      );
      return;
    }

    return this.run(subcommand, targetUser, new MessageResponder(guildMessage));
  }

  private async run(subcommand: string, targetUser: User, ctx: CommandResponder) {
    await ctx.deferPublicClassic();

    // Check if bot
    if (targetUser.bot) {
      return ctx.editReply({
        content: `${EMOJI.STATUS.ERROR} Bots don't earn XP!`,
      });
    }

    if (subcommand === 'voice') {
      return this.handleVoiceRank(ctx, targetUser);
    } else {
      return this.handleTextRank(ctx, targetUser);
    }
  }

  /**
   * Handle text/message XP rank card
   */
  private async handleTextRank(ctx: CommandResponder, targetUser: User) {
    const guildId = ctx.guild.id;
    try {
      // Get user stats
      const stats = await leaderboardService.getUserStats(guildId, targetUser.id);

      if (!stats) {
        return ctx.editReply({
          content: `${EMOJI.STATUS.ERROR} ${targetUser.id === ctx.user.id ? 'You have' : 'This user has'} not earned any XP yet. Start chatting to earn XP!`,
        });
      }

      // Calculate XP needed for next level
      const xpNeededForNextLevel = stats.nextLevelXp - stats.currentLevelXp;
      const xpInCurrentLevel = stats.xp - stats.currentLevelXp;

      // Get user avatar
      const avatarUrl = targetUser.displayAvatarURL({
        extension: 'png',
        size: 256,
      });

      // Fetch detailed XP breakdown data
      const xpBreakdown = await this.rankDataService.getTextXPBreakdown(guildId, targetUser.id);
      const activityData = await this.rankDataService.getTextActivityData(guildId, targetUser.id);

      // Get member join date
      const memberSince = await this.rankDataService.getMemberSince(guildId, targetUser.id);

      if (stats.rank === null) {
        throw new Error(`Rank is unavailable for XP member ${targetUser.id}`);
      }

      // Generate rank card
      const cardImage = await imageGenClient.generateRankCard({
        username: targetUser.username,
        avatarUrl: avatarUrl,
        cardType: 'text',
        totalXP: stats.xp,
        level: stats.level,
        currentXP: xpInCurrentLevel,
        requiredXP: xpNeededForNextLevel,
        maxLevel: xpNeededForNextLevel <= 0,
        rank: stats.rank,
        primaryValue: xpBreakdown.messageXP,
        secondaryValue: xpBreakdown.voiceXP,
        mostActiveChannel: activityData.channel.name,
        activityState: activityData.channel.state,
        last7DaysValue: activityData.last7DaysXP,
        streak: activityData.streak,
        memberSince: memberSince,
      });

      // Create attachment
      const attachment = new AttachmentBuilder(cardImage, {
        name: 'rank-card.png',
      });

      // Send the image
      return ctx.editReply({
        files: [attachment],
      });
    } catch (error) {
      this.container.logger.error('Error generating rank card:', error);

      // Fallback to text-based embed
      const stats = await leaderboardService.getUserStats(guildId, targetUser.id);

      if (!stats) {
        return ctx.editReply({
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
            `📊 **${stats.rank === null ? 'Unranked' : `Rank #${stats.rank}`}** among ${totalMembers} members`
        )
        .addFields({
          name: 'Progress to Next Level',
          value: `${xpInCurrentLevel.toLocaleString()} / ${xpNeededForNextLevel.toLocaleString()} XP (${stats.progress.toFixed(1)}%)`,
        })
        .setFooter({ text: 'Card generation failed, showing text-based stats' })
        .setTimestamp();

      return ctx.editReply({
        embeds: [embed],
        content: `${EMOJI.STATUS.WARNING} Image generation failed, showing text-based stats instead.`,
      });
    }
  }

  /**
   * Handle voice XP rank card
   */
  private async handleVoiceRank(ctx: CommandResponder, targetUser: User) {
    const guildId = ctx.guild.id;
    try {
      // Get voice stats
      const stats = await voiceLeaderboardService.getVoiceUserStats(guildId, targetUser.id);

      if (!stats) {
        return ctx.editReply({
          content: `${EMOJI.STATUS.ERROR} ${targetUser.id === ctx.user.id ? 'You have' : 'This user has'} not earned any voice XP yet. Join voice channels to earn voice XP!`,
        });
      }

      // Calculate XP needed for next level
      const xpNeededForNextLevel = stats.nextLevelXp - stats.currentLevelXp;
      const xpInCurrentLevel = stats.xp - stats.currentLevelXp;

      // Get user avatar
      const avatarUrl = targetUser.displayAvatarURL({
        extension: 'png',
        size: 256,
      });

      // Fetch detailed voice XP breakdown data
      const voiceBreakdown = await this.rankDataService.getVoiceXPBreakdown(guildId, targetUser.id);
      const voiceActivityData = await this.rankDataService.getVoiceActivityData(
        guildId,
        targetUser.id
      );

      // Get member join date
      const memberSince = await this.rankDataService.getMemberSince(guildId, targetUser.id);

      if (stats.rank === null) {
        throw new Error(`Rank is unavailable for voice XP member ${targetUser.id}`);
      }

      // Generate rank card
      const cardImage = await imageGenClient.generateRankCard({
        username: targetUser.username,
        avatarUrl: avatarUrl,
        cardType: 'voice',
        totalXP: stats.xp,
        level: stats.level,
        currentXP: xpInCurrentLevel,
        requiredXP: xpNeededForNextLevel,
        maxLevel: xpNeededForNextLevel <= 0,
        rank: stats.rank,
        primaryValue: voiceBreakdown.totalVoiceXP,
        secondaryValue: voiceBreakdown.minutesInVoice,
        mostActiveChannel: voiceActivityData.channel.name,
        activityState: voiceActivityData.channel.state,
        last7DaysValue: voiceActivityData.last7DaysMinutes,
        streak: voiceActivityData.streak,
        memberSince: memberSince,
      });

      // Create attachment
      const attachment = new AttachmentBuilder(cardImage, {
        name: 'voice-rank-card.png',
      });

      // Send the image
      return ctx.editReply({
        files: [attachment],
      });
    } catch (error) {
      this.container.logger.error('Error generating voice rank card:', error);

      // Fallback to text-based embed
      const stats = await voiceLeaderboardService.getVoiceUserStats(guildId, targetUser.id);

      if (!stats) {
        return ctx.editReply({
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
            `📊 **${stats.rank === null ? 'Unranked' : `Rank #${stats.rank}`}** among ${totalMembers} members`
        )
        .addFields({
          name: 'Progress to Next Level',
          value: `${xpInCurrentLevel.toLocaleString()} / ${xpNeededForNextLevel.toLocaleString()} XP (${stats.progress.toFixed(1)}%)`,
        })
        .setFooter({ text: 'Card generation failed, showing text-based stats' })
        .setTimestamp();

      return ctx.editReply({
        embeds: [embed],
        content: `${EMOJI.STATUS.WARNING} Image generation failed, showing text-based stats instead.`,
      });
    }
  }
}
