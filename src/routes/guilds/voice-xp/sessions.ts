import { Route } from '@sapphire/plugin-api';
import { getUserVoiceSessions } from '#root/modules/xp/xp-voice/index.js';

export class VoiceXPSessionsRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/voice-xp/users/[userId]/sessions',
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

    const limit = parseInt(request.query.limit as string) || 10;

    try {
      const sessions = await getUserVoiceSessions(guildId, userId, limit);
      return response.json({
        guildId,
        userId,
        sessions,
      });
    } catch (error) {
      this.container.logger.error('[Voice XP API] Error fetching user sessions:', error);
      return response.status(500).json({
        error: 'Failed to fetch user voice sessions',
      });
    }
  }
}
