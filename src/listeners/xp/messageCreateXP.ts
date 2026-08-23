/**
 * XP Award Listener for Text Messages
 * Listens to messageCreate events and awards XP based on guild configuration
 */

import { Listener, Events } from '@sapphire/framework';
import { Message, MessageFlags, TextChannel, NewsChannel } from 'discord.js';
import { container as fluentContainer } from '../../lib/discord/containers/container.js';
import { awardService, configService } from '../../modules/xp/xp-text/services/index.js';
import { parseTemplate } from '../../modules/xp/xp-text/utils/templates.js';
import type {
  TemplateVariables,
  ValidationContext,
} from '../../modules/xp/xp-text/types/xp-text.types.js';
import { RewardIntegration } from '../../modules/rewards/integrations/RewardIntegration.js';
import type { RewardClaimResult } from '../../lib/types/rewards.types.js';

export class MessageCreateXPListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.MessageCreate,
    });
  }

  public async run(message: Message) {
    // Quick checks before processing
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.member) return;

    const guildId = message.guild.id;
    const userId = message.author.id;

    try {
      // Check if XP system is enabled (uses cache)
      const enabled = await configService.isEnabled(guildId);
      if (!enabled) return;

      // Get guild configuration to check ignored channels
      const config = await configService.getConfig(guildId);

      // Check if current channel is in ignored channels list
      if (config.ignoredChannels?.includes(message.channel.id)) {
        return;
      }

      // Check if user has any ignored roles
      const userRoleIds = message.member.roles.cache.map((role) => role.id);
      if (config.ignoredRoles?.some((roleId) => userRoleIds.includes(roleId))) {
        return;
      }

      // Build validation context
      const context: ValidationContext = {
        guildId,
        userId,
        channelId: message.channel.id,
        messageContent: message.content,
        userRoles: message.member.roles.cache.map((role) => role.id),
        isBot: message.author.bot,
        isDM: false,
      };

      // Award XP with all validation and safety checks
      const result = await awardService.awardXP(context);

      // If not awarded, silently return (cooldown, filters, etc.)
      if (!result.awarded) {
        return;
      }

      // Handle level-up announcement
      if (result.leveledUp && result.newLevel) {
        await this.handleLevelUpAnnouncement(
          message,
          guildId,
          userId,
          result.newLevel,
          result.xpGained ?? 0,
          result.newXp ?? 0
        );
      }
    } catch (error) {
      this.container.logger.error('Error in XP award listener:', error);
    }
  }

  /**
   * Handle level-up announcement
   */
  private async handleLevelUpAnnouncement(
    message: Message,
    guildId: string,
    userId: string,
    newLevel: number,
    xpGained: number,
    totalXp: number
  ): Promise<void> {
    try {
      // Check and apply rewards for the new level
      let rewardResults: RewardClaimResult[] = [];
      if (message.guild && message.member) {
        rewardResults = await RewardIntegration.onTextLevelUp(
          guildId,
          userId,
          newLevel,
          totalXp,
          message.guild,
          message.member
        );
      }

      // Get guild configuration
      const config = await configService.getConfig(guildId);

      // Check if announcements are enabled
      if (!config.announceLevelUp) return;

      // Determine announcement channel
      let announcementChannel = message.channel;
      if (config.announceChannelId) {
        const customChannel = message.guild?.channels.cache.get(config.announceChannelId);
        if (
          customChannel &&
          (customChannel instanceof TextChannel || customChannel instanceof NewsChannel)
        ) {
          announcementChannel = customChannel;
        }
      }

      // Ensure we have a sendable channel
      if (
        !(announcementChannel instanceof TextChannel || announcementChannel instanceof NewsChannel)
      ) {
        return;
      }

      // Build template variables
      const variables: TemplateVariables = {
        user: `<@${userId}>`,
        userId,
        username: message.author.username,
        level: newLevel,
        xpGain: xpGained,
        totalXp,
        nextLevelXp: 0, // Will be calculated if needed
        progress: 0,
        type: 'Text',
      };

      // Use custom template or fallback
      const template = config.messageTemplate || '🎉 {user} reached level {level}!';
      let messageText = parseTemplate(template, variables);

      // Add rewards summary if any rewards were earned
      const rewardsSummary = RewardIntegration.formatRewardsSummary(rewardResults);
      if (rewardsSummary) {
        messageText += rewardsSummary;
      }

      // Send announcement
      if (config.embedEnabled) {
        const ui = fluentContainer({ color: config.embedColor })
          .h2('Text XP Level Up')
          .text(messageText)
          .footerWithTimestamp();

        await announcementChannel.send({
          components: [ui.build()],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { parse: ['users'] },
        });
      } else {
        await announcementChannel.send(messageText);
      }
    } catch (error) {
      this.container.logger.error('Error sending level-up announcement:', error);
    }
  }
}
