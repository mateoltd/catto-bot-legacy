import { Route } from '@sapphire/plugin-api';
import { resetUserXP } from '#root/modules/xp/xp-text/index.js';
import { parseRequestBody } from '#lib/route-utils.js';

export class XPResetUserRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/xp/reset/user',
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

    // Verify guild exists
    const guild = this.container.client.guilds.cache.get(guildId);
    if (!guild) {
      return response.status(404).json({
        error: 'Guild not found or bot is not in the guild',
      });
    }

    // Parse body
    const body = (await parseRequestBody(request)) as
      | { userId?: string; reason?: string }
      | undefined;
    const userId = body?.userId;
    const reason = body?.reason;

    if (!userId) {
      return response.status(400).json({
        error: 'userId is required in request body',
      });
    }

    try {
      await resetUserXP(guildId, userId, reason);

      return response.json({
        success: true,
        message: `XP reset for user ${userId}`,
        guildId,
        userId,
      });
    } catch (error) {
      this.container.logger.error('Error resetting user XP:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
