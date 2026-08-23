import { Route } from '@sapphire/plugin-api';
import { ChannelType } from 'discord.js';

export class LoggingDeleteRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/logging/delete',
      methods: ['DELETE'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;

    if (!guildId) {
      return response.status(400).json({
        error: 'Guild ID is required',
      });
    }

    // Verify guild exists in cache
    const guild = this.container.client.guilds.cache.get(guildId);
    if (!guild) {
      return response.status(404).json({
        error: 'Guild not found or bot is not in the guild',
      });
    }

    const { client } = this.container;
    if (!client.user) {
      return response.status(500).json({
        error: 'Client user not found',
      });
    }

    // Check if bot has required permissions
    const botMember = guild.members.cache.get(client.user.id);
    if (!botMember) {
      return response.status(403).json({
        error: 'Bot is not a member of this guild',
      });
    }

    if (!botMember.permissions.has(['ManageChannels', 'ManageWebhooks'])) {
      return response.status(403).json({
        error: 'Bot does not have required permissions (Manage Channels, Manage Webhooks)',
      });
    }

    try {
      // Get the log configuration
      const logConfig = await this.container.prisma.logConfig.findUnique({
        where: { guildId },
      });

      if (!logConfig) {
        return response.status(404).json({
          error: 'Logging system not set up',
        });
      }

      let deletedChannels = 0;

      // Delete the category and all channels inside
      if (logConfig.categoryId) {
        const category = guild.channels.cache.get(logConfig.categoryId);
        if (category && category.type === ChannelType.GuildCategory) {
          // Delete all channels in the category first
          const channelsInCategory = guild.channels.cache.filter(
            (ch) => ch.parentId === category.id
          );

          for (const [, channel] of channelsInCategory) {
            try {
              await channel.delete();
              deletedChannels++;
            } catch (error) {
              this.container.logger.error(`Error deleting channel ${channel.name}:`, error);
            }
          }

          // Delete the category itself
          try {
            await category.delete();
            deletedChannels++; // Count the category
          } catch (error) {
            this.container.logger.error('Error deleting category:', error);
          }
        }
      }

      // Delete the configuration from database
      await this.container.prisma.logConfig.delete({
        where: { guildId },
      });

      return response.json({
        success: true,
        deletedChannels,
        message: 'Logging system successfully deleted',
      });
    } catch (error) {
      this.container.logger.error('Error deleting logging system:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
