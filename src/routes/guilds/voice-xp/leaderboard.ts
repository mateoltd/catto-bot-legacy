import { getVoiceLeaderboard } from '#root/modules/xp/xp-voice/index.js';
import { Route } from '@sapphire/plugin-api';

export class VoiceXPLeaderboardRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/voice-xp/leaderboard',
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

    const limit = parseInt(request.query.limit as string) || 10;
    const page = parseInt(request.query.page as string) || 1;
    const offset = (page - 1) * limit;

    try {
      const leaderboard = await getVoiceLeaderboard(guildId, limit, offset);
      return response.json(leaderboard);
    } catch (error) {
      this.container.logger.error('[Voice XP API] Error fetching leaderboard:', error);
      return response.status(500).json({
        error: 'Failed to fetch voice XP leaderboard',
      });
    }
  }
}
