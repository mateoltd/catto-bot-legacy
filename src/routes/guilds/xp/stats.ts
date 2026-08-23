import { leaderboardService } from '#root/modules/xp/xp-text/index.js';
import { Route } from '@sapphire/plugin-api';

export class XPUserStatsRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/xp/users/[userId]',
      methods: ['GET'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId, userId } = request.params;

    if (!guildId || !userId) {
      return response.status(400).json({
        error: 'Guild ID and User ID are required',
      });
    }

    // Verify guild exists
    const guild = this.container.client.guilds.cache.get(guildId);
    if (!guild) {
      return response.status(404).json({
        error: 'Guild not found or bot is not in the guild',
      });
    }

    try {
      const stats = await leaderboardService.getUserStats(guildId, userId);

      if (!stats) {
        return response.status(404).json({
          error: 'User not found or has no XP',
        });
      }

      return response.json({
        success: true,
        stats,
      });
    } catch (error) {
      this.container.logger.error('Error fetching user stats:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
