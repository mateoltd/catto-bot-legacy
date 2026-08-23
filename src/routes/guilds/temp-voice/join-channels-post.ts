/**
 * POST /api/guilds/[guildId]/temp-voice/join-channels
 * Add a join-to-create channel to the configuration
 */

import { Route } from '@sapphire/plugin-api';
import { TempVoiceConfigServiceStatic as TempVoiceConfigService } from '#modules/temp-voice/services/config-api.service.js';
import { RouteRequestWithBody } from '#root/lib/route-types.js';
import { validateDto } from '#lib/validation/validate-dto.js';
import { AddJoinChannelDto } from '#lib/dtos/temp-voice/temp-voice-config.dto.js';
import { ApiGate } from '#lib/validation/ApiGate.js';

export class TempVoiceJoinChannelsPostRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/temp-voice/join-channels',
      methods: ['POST'],
    });
  }

  public run(request: Route.Request, response: Route.Response) {
    return this.handlePost(request as RouteRequestWithBody, response);
  }

  private async handlePost(request: RouteRequestWithBody, response: Route.Response) {
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

      // Parse body if it's a string
      let body: unknown = request.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }

      // Validate request body
      const validationResult = await validateDto(AddJoinChannelDto, body);

      if (!validationResult.success) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: validationResult.errors?.map((err) => ({
              field: err.field,
              message: err.constraints.join(', '),
            })),
          },
        });
      }

      if (!validationResult.data) {
        return response.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request data' },
        });
      }

      const { channelId } = validationResult.data;

      // Get config
      const config = await TempVoiceConfigService.getConfig(guildId);
      if (!config) {
        return response.status(404).json({
          success: false,
          error: {
            code: 'CONFIG_NOT_FOUND',
            message: 'Temp Voice configuration not found for this guild',
          },
          data: {
            suggestion:
              'Create a configuration first using POST /api/guilds/[guildId]/temp-voice/config',
          },
        });
      }

      // Check if channel already exists in join channels
      if (config.joinChannelIds.includes(channelId)) {
        return response.status(409).json({
          success: false,
          error: {
            code: 'CHANNEL_ALREADY_EXISTS',
            message: 'This channel is already configured as a join-to-create channel',
          },
        });
      }

      // Validate channel exists and is a voice channel
      const guild = this.container.client.guilds.cache.get(guildId);
      if (!guild) {
        return response.status(404).json({
          success: false,
          error: {
            code: 'GUILD_NOT_FOUND',
            message: 'Guild not found',
          },
        });
      }

      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        return response.status(404).json({
          success: false,
          error: {
            code: 'CHANNEL_NOT_FOUND',
            message: 'Channel not found in this guild',
          },
        });
      }

      if (!channel.isVoiceBased()) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CHANNEL_TYPE',
            message: 'Channel must be a voice channel',
          },
        });
      }

      // Add channel to join channels
      const updatedConfig = await TempVoiceConfigService.addJoinChannel(guildId, channelId);

      this.container.logger.info(
        `[TempVoice API] Added join channel ${channelId} for guild ${guildId}`
      );

      return response.status(201).json({
        success: true,
        message: 'Join-to-create channel added successfully',
        data: {
          guildId,
          channelId,
          channelName: channel.name,
          joinChannelIds: updatedConfig.joinChannelIds,
        },
      });
    } catch (error) {
      this.container.logger.error('[TempVoice API] Error adding join channel:', error);

      return response.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while adding the join-to-create channel',
        },
      });
    }
  }
}
