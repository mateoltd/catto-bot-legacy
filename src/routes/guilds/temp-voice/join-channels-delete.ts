/**
 * DELETE /api/guilds/[guildId]/temp-voice/join-channels/[channelId]
 * Remove a join-to-create channel from the configuration
 */

import { Route } from '@sapphire/plugin-api';
import { TempVoiceConfigServiceStatic as TempVoiceConfigService } from '#modules/temp-voice/services/config-api.service.js';
import { ApiGate } from '#lib/validation/ApiGate.js';

export class TempVoiceJoinChannelsDeleteRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/temp-voice/join-channels/[channelId]',
      methods: ['DELETE'],
    });
  }

  public run(request: Route.Request, response: Route.Response) {
    return this.handleDelete(request, response);
  }

  private async handleDelete(request: Route.Request, response: Route.Response) {
    try {
      const guildId = request.params.guildId;
      const channelId = request.params.channelId;

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

      if (!channelId) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'MISSING_CHANNEL_ID',
            message: 'Channel ID is required',
          },
        });
      }

      // Validate channel ID format
      if (!/^\d{17,19}$/.test(channelId)) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CHANNEL_ID',
            message: 'Invalid channel ID format',
          },
        });
      }

      // Get config
      const config = await TempVoiceConfigService.getConfig(guildId);
      if (!config) {
        return response.status(404).json({
          success: false,
          error: {
            code: 'CONFIG_NOT_FOUND',
            message: 'Temp Voice configuration not found for this guild',
          },
        });
      }

      // Check if channel exists in join channels
      if (!config.joinChannelIds.includes(channelId)) {
        return response.status(404).json({
          success: false,
          error: {
            code: 'CHANNEL_NOT_IN_CONFIG',
            message: 'This channel is not configured as a join-to-create channel',
          },
        });
      }

      // Remove channel from join channels
      const updatedConfig = await TempVoiceConfigService.removeJoinChannel(guildId, channelId);

      this.container.logger.info(
        `[TempVoice API] Removed join channel ${channelId} for guild ${guildId}`
      );

      return response.json({
        success: true,
        message: 'Join-to-create channel removed successfully',
        data: {
          guildId,
          channelId,
          joinChannelIds: updatedConfig.joinChannelIds,
        },
      });
    } catch (error) {
      this.container.logger.error('[TempVoice API] Error removing join channel:', error);

      return response.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while removing the join-to-create channel',
        },
      });
    }
  }
}
