import { leaderboardService } from '#root/modules/xp/xp-text/index.js';
import { Route } from '@sapphire/plugin-api';

export class XPLeaderboardRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/xp/leaderboard',
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

    // Verify guild exists
    const guild = this.container.client.guilds.cache.get(guildId);
    if (!guild) {
      return response.status(404).json({
        error: 'Guild not found or bot is not in the guild',
      });
    }

    // Parse query parameters
    const limitParam = request.query?.limit as string | undefined;
    const offsetParam = request.query?.offset as string | undefined;

    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam)), 100) : 10;
    const offset = offsetParam ? Math.max(0, parseInt(offsetParam)) : 0;

    try {
      const leaderboard = await leaderboardService.getLeaderboard(guildId, limit, offset);

      return response.json({
        success: true,
        leaderboard,
      });
    } catch (error) {
      this.container.logger.error('Error fetching leaderboard:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
