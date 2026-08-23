import { EMOJI } from '#lib/discord/design/index.js';
import { RewardService, XPType, LevelRewardConfig } from '#root/modules/rewards/index.js';
import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';

export class RewardsCommand extends Command {
  private rewardService!: RewardService;

  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'rewards',
      description: 'View available XP rewards in this server',
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .setDMPermission(false)
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Filter by XP type')
            .addChoices(
              { name: 'Text XP', value: 'TEXT' },
              { name: 'Voice XP', value: 'VOICE' },
              { name: 'Both', value: 'BOTH' }
            )
        )
        .addUserOption((opt) =>
          opt.setName('user').setDescription('View rewards for a specific user')
        )
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
    }

    const guildId = interaction.guildId;

    // Initialize service if needed
    if (!this.rewardService) {
      const { prisma } = this.container;
      this.rewardService = new RewardService(prisma);
    }

    const typeFilter = interaction.options.getString('type') as XPType | null;
    const targetUser = interaction.options.getUser('user') || interaction.user;

    await interaction.deferReply();

    try {
      // Get guild rewards
      const rewards = await this.rewardService.getGuildRewards(guildId);

      // Filter by type if specified
      let filteredRewards = rewards.filter((r) => r.enabled);
      if (typeFilter) {
        filteredRewards = filteredRewards.filter(
          (r) => r.xpType === typeFilter || r.xpType === XPType.BOTH
        );
      }

      if (filteredRewards.length === 0) {
        return interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} No rewards are configured in this server yet.`,
        });
      }

      // Get user's current level and progress
      const userLevel = await this.getUserLevel(targetUser.id, guildId);

      // Group rewards by level
      const rewardsByLevel = new Map<number, LevelRewardConfig[]>();
      for (const reward of filteredRewards) {
        if (!rewardsByLevel.has(reward.level)) {
          rewardsByLevel.set(reward.level, []);
        }
        const levelRewards = rewardsByLevel.get(reward.level);
        if (levelRewards) {
          levelRewards.push(reward);
        }
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJI.REWARDS.GIFT} Server Rewards`)
        .setColor(0x5865f2)
        .setDescription(
          `${targetUser.username}'s Current Level: **${userLevel}**\n\n` +
            `Total Available Rewards: ${filteredRewards.length}` +
            `${typeFilter ? `\nFiltered by: ${typeFilter}` : ''}`
        )
        .setThumbnail(targetUser.displayAvatarURL());

      const sortedLevels = Array.from(rewardsByLevel.keys()).sort((a, b) => a - b);
      let fieldCount = 0;

      for (const level of sortedLevels) {
        if (fieldCount >= 25) break; // Discord field limit

        const levelRewards = rewardsByLevel.get(level);
        if (!levelRewards) continue;
        const statusIcon =
          level <= userLevel
            ? EMOJI.STATUS.SUCCESS
            : level === userLevel + 1
              ? EMOJI.PROGRESS.ARROW_UP
              : EMOJI.CHANNELS.STATE.LOCKED;

        const rewardList = levelRewards.map((r) => `${r.icon || '•'} **${r.name}**`).join('\n');

        embed.addFields({
          name: `${statusIcon} Level ${level}`,
          value: rewardList,
          inline: true,
        });
        fieldCount++;
      }

      embed.setFooter({
        text: `${EMOJI.STATUS.SUCCESS} = Unlocked | ${EMOJI.PROGRESS.ARROW_UP} = Next Level | ${EMOJI.CHANNELS.STATE.LOCKED} = Locked`,
      });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error('Failed to fetch rewards:', error);
      return interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} Failed to fetch rewards. Please try again.`,
      });
    }
  }

  private async getUserLevel(userId: string, guildId: string): Promise<number> {
    try {
      const xpData = await this.container.prisma.userXP.findUnique({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
      });

      return xpData?.level || 0;
    } catch {
      return 0;
    }
  }
}
