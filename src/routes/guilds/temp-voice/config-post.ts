/**
 * POST /api/guilds/[guildId]/temp-voice/config
 * Create new Temp Voice configuration for a guild
 */

import { Route } from '@sapphire/plugin-api';
import { TempVoiceConfigServiceStatic as TempVoiceConfigService } from '#modules/temp-voice/services/config-api.service.js';
import { RouteRequestWithBody } from '#root/lib/route-types.js';
import { validateDto } from '#lib/validation/validate-dto.js';
import { CreateTempVoiceConfigDto } from '#lib/dtos/temp-voice/temp-voice-config.dto.js';
import { ApiGate } from '#lib/validation/ApiGate.js';

export class TempVoiceConfigPostRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/temp-voice/config',
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

      // Default to empty object if body is undefined
      if (!body) {
        body = {};
      }

      // Check if config already exists
      const existingConfig = await TempVoiceConfigService.getConfig(guildId);
      if (existingConfig) {
        return response.status(409).json({
          success: false,
          error: {
            code: 'CONFIG_ALREADY_EXISTS',
            message: 'Temp Voice configuration already exists for this guild',
          },
          data: {
            guildId,
            suggestion:
              'Use PATCH /api/guilds/[guildId]/temp-voice/config to update existing configuration',
          },
        });
      }

      // Validate request body
      const validationResult = await validateDto(CreateTempVoiceConfigDto, body);

      if (!validationResult.success) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid configuration data',
            details: validationResult.errors?.map((err) => ({
              field: err.field,
              message: err.constraints.join(', '),
            })),
          },
        });
      }

      const configData = validationResult.data as CreateTempVoiceConfigDto;

      // Validate join channel IDs exist and are voice channels
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

      for (const channelId of configData.joinChannelIds) {
        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
          return response.status(400).json({
            success: false,
            error: {
              code: 'CHANNEL_NOT_FOUND',
              message: `Join-to-create channel ${channelId} not found in guild`,
            },
          });
        }

        if (!channel.isVoiceBased()) {
          return response.status(400).json({
            success: false,
            error: {
              code: 'INVALID_CHANNEL_TYPE',
              message: `Channel ${channelId} is not a voice channel`,
            },
          });
        }
      }

      // Validate default category if provided
      if (configData.defaultCategoryId) {
        const category = guild.channels.cache.get(configData.defaultCategoryId);
        if (!category) {
          return response.status(400).json({
            success: false,
            error: {
              code: 'CATEGORY_NOT_FOUND',
              message: `Default category ${configData.defaultCategoryId} not found in guild`,
            },
          });
        }

        if (category.type !== 4) {
          // CategoryChannel
          return response.status(400).json({
            success: false,
            error: {
              code: 'INVALID_CATEGORY',
              message: `Channel ${configData.defaultCategoryId} is not a category`,
            },
          });
        }
      }

      // Validate log channel if provided
      if (configData.logChannelId) {
        const logChannel = guild.channels.cache.get(configData.logChannelId);
        if (!logChannel) {
          return response.status(400).json({
            success: false,
            error: {
              code: 'LOG_CHANNEL_NOT_FOUND',
              message: `Log channel ${configData.logChannelId} not found in guild`,
            },
          });
        }

        if (!logChannel.isTextBased()) {
          return response.status(400).json({
            success: false,
            error: {
              code: 'INVALID_LOG_CHANNEL',
              message: `Channel ${configData.logChannelId} is not a text channel`,
            },
          });
        }
      }

      // Create configuration
      const config = await TempVoiceConfigService.createConfig(guildId, configData);

      this.container.logger.info(`[TempVoice API] Created config for guild ${guildId}`);

      return response.status(201).json({
        success: true,
        message: 'Temp Voice configuration created successfully',
        data: {
          guildId: config.guildId,
          enabled: config.enabled,
          joinChannelIds: config.joinChannelIds,
          namingScheme: config.namingScheme,
          customNamingPattern: config.customNamingPattern,
          userLimit: config.userLimit,
          bitrate: config.bitrate,
          defaultCategoryId: config.defaultCategoryId,
          defaultLocked: config.defaultLocked,
          defaultHidden: config.defaultHidden,
          autoDeleteEmpty: config.autoDeleteEmpty,
          deleteEmptyAfterMs: config.deleteEmptyAfterMs,
          ownerLeaveStrategy: config.ownerLeaveStrategy,
          allowOwnerTransfer: config.allowOwnerTransfer,
          allowOwnerManagement: config.allowOwnerManagement,
          maxChannelsPerUser: config.maxChannelsPerUser,
          logChannelId: config.logChannelId,
          enableNameModeration: config.enableNameModeration,
          blockedKeywords: config.blockedKeywords,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        },
      });
    } catch (error) {
      this.container.logger.error('[TempVoice API] Error creating config:', error);

      return response.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while creating the configuration',
        },
      });
    }
  }
}
