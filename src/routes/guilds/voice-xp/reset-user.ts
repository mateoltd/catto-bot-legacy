import { Route } from '@sapphire/plugin-api';
import { resetUserVoiceXP } from '#root/modules/xp/xp-voice/index.js';
import { parseRequestBody } from '#lib/route-utils.js';

export class VoiceXPResetUserRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/voice-xp/reset/user',
      methods: ['POST'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;

    if (!guildId) {
      return response.status(400).json({
        error: 'Guild ID is required',
      });
    }

    const body = (await parseRequestBody(request)) as
      | { userId?: string; reason?: string }
      | undefined;

    if (!body || !body.userId) {
      return response.status(400).json({
        error: 'Request body with userId is required',
      });
    }

    try {
      await resetUserVoiceXP(guildId, body.userId, body.reason || 'Manual reset via API');
      return response.json({
        success: true,
        message: 'User voice XP reset successfully',
      });
    } catch (error) {
      this.container.logger.error('[Voice XP API] Error resetting user voice XP:', error);
      return response.status(500).json({
        error: 'Failed to reset user voice XP',
      });
    }
  }
}
