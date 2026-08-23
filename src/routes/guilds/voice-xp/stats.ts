import { getVoiceUserStats } from '#root/modules/xp/xp-voice/index.js';
import { Route } from '@sapphire/plugin-api';

export class VoiceXPStatsRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/voice-xp/users/[userId]',
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

    try {
      const stats = await getVoiceUserStats(guildId, userId);

      if (!stats) {
        return response.status(404).json({
          error: 'User voice XP not found',
        });
      }

      return response.json(stats);
    } catch (error) {
      this.container.logger.error('[Voice XP API] Error fetching user stats:', error);
      return response.status(500).json({
        error: 'Failed to fetch user voice XP stats',
      });
    }
  }
}
