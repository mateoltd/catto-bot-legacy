import { Route } from '@sapphire/plugin-api';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Route.Options>({
  route: 'guilds/[guildId]/stats',
})
export class GuildStatsRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      methods: ['GET'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;

    if (!guildId) {
      return response.status(400).json({
        error: 'Guild ID is required',
      });
    }

    try {
      // Get guild from database
      const guild = await this.container.prisma.guild.findUnique({
        where: { guildId },
        include: {
          users: true,
        },
      });

      if (!guild) {
        return response.status(404).json({
          error: 'Guild not found',
        });
      }

      // Get Discord guild
      const discordGuild = this.container.client.guilds.cache.get(guildId);

      if (!discordGuild) {
        return response.status(404).json({
          error: 'Guild not found in bot cache',
        });
      }

      // Get recent logs for this guild
      const recentLogs = await this.container.prisma.log.findMany({
        where: {
          metadata: {
            path: ['guildId'],
            equals: guildId,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      });

      return response.json({
        guild: {
          id: guild.guildId,
          name: guild.name,
          language: guild.language,
        },
        stats: {
          databaseUsers: guild.users.length,
          memberCount: discordGuild.memberCount,
          channelCount: discordGuild.channels.cache.size,
          roleCount: discordGuild.roles.cache.size,
          emojiCount: discordGuild.emojis.cache.size,
          stickerCount: discordGuild.stickers.cache.size,
          createdAt: guild.createdAt,
          joinedAt: discordGuild.joinedAt,
          updatedAt: guild.updatedAt,
        },
        recentActivity: recentLogs.map((log) => ({
          id: log.id,
          level: log.level,
          message: log.message,
          timestamp: log.createdAt,
        })),
      });
    } catch (error) {
      this.container.logger.error('Error fetching guild stats:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
