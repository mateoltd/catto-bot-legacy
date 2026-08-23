/**
 * DELETE /api/guilds/[guildId]/temp-voice/config
 * Delete Temp Voice configuration for a guild
 */

import { Route } from '@sapphire/plugin-api';
import { TempVoiceConfigServiceStatic as TempVoiceConfigService } from '#modules/temp-voice/services/config-api.service.js';
import { ApiGate } from '#lib/validation/ApiGate.js';

export class TempVoiceConfigDeleteRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/temp-voice/config',
      methods: ['DELETE'],
    });
  }

  public run(request: Route.Request, response: Route.Response) {
    return this.handleDelete(request, response);
  }

  private async handleDelete(request: Route.Request, response: Route.Response) {
    try {
      const guildId = request.params.guildId;

      if (!guildId) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'MISSING_GUILD_ID',
            message: 'Guild ID is required',
          },
        });
      }

      const gate = await ApiGate.fromRequest(request, guildId);
      if (!gate) {
        return response.status(401).json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' });
      }
      const auth = await gate.checkAuth('tempvoice.config');
      if (!auth.ok) {
        return response.status(403).json({ error: 'Forbidden', code: auth.code });
      }

      // Check if config exists
      const existingConfig = await TempVoiceConfigService.getConfig(guildId);
      if (!existingConfig) {
        return response.status(404).json({
          success: false,
          error: {
            code: 'CONFIG_NOT_FOUND',
            message: 'Temp Voice configuration not found for this guild',
          },
        });
      }

      // Delete configuration
      await TempVoiceConfigService.deleteConfig(guildId);

      this.container.logger.info(`[TempVoice API] Deleted config for guild ${guildId}`);

      return response.json({
        success: true,
        message: 'Temp Voice configuration deleted successfully',
        data: {
          guildId,
        },
      });
    } catch (error) {
      this.container.logger.error('[TempVoice API] Error deleting config:', error);

      return response.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while deleting the configuration',
        },
      });
    }
  }
}
