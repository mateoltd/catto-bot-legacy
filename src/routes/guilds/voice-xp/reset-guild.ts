import { Route } from '@sapphire/plugin-api';
import { resetGuildVoiceXP } from '#root/modules/xp/xp-voice/index.js';
import { parseRequestBody } from '#lib/route-utils.js';

export class VoiceXPResetGuildRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/voice-xp/reset/guild',
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

    const body = (await parseRequestBody(request)) as { reason?: string } | undefined;
    const reason = body?.reason || 'Manual guild reset via API';

    try {
      const resetCount = await resetGuildVoiceXP(guildId, reason);
      return response.json({
        success: true,
        message: 'Guild voice XP reset successfully',
        usersReset: resetCount,
      });
    } catch (error) {
      this.container.logger.error('[Voice XP API] Error resetting guild voice XP:', error);
      return response.status(500).json({
        error: 'Failed to reset guild voice XP',
      });
    }
  }
}
