/**
 * POST /api/guilds/[guildId]/temp-voice/validate
 * Validate Temp Voice configuration without saving
 */

import { Route } from '@sapphire/plugin-api';
import { RouteRequestWithBody } from '#root/lib/route-types.js';
import { validateDto } from '#lib/validation/validate-dto.js';
import { CreateTempVoiceConfigDto } from '#lib/dtos/temp-voice/temp-voice-config.dto.js';
import { ApiGate } from '#lib/validation/ApiGate.js';

export class TempVoiceValidateRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/temp-voice/validate',
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
      const auth = await gate.checkAuth('tempvoice.view');
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

      // Validate against schema
      const validationResult = await validateDto(CreateTempVoiceConfigDto, body);

      if (!validationResult.success) {
        return response.status(400).json({
          success: false,
          valid: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Configuration validation failed',
            details: validationResult.errors?.map((err) => ({
              field: err.field,
              message: err.constraints.join(', '),
              value: (body as Record<string, unknown>)?.[err.field],
            })),
          },
        });
      }

      const configData = validationResult.data as CreateTempVoiceConfigDto;

      // Get guild for channel validation
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

      // Validate join channels
      const channelValidations = [];
      for (const channelId of configData.joinChannelIds) {
        const channel = guild.channels.cache.get(channelId);

        if (!channel) {
          channelValidations.push({
            channelId,
            valid: false,
            error: 'Channel not found',
          });
        } else if (!channel.isVoiceBased()) {
          channelValidations.push({
            channelId,
            channelName: channel.name,
            valid: false,
            error: 'Channel is not a voice channel',
          });
        } else {
          channelValidations.push({
            channelId,
            channelName: channel.name,
            valid: true,
          });
        }
      }

      // Validate default category
      let categoryValidation = null;
      if (configData.defaultCategoryId) {
        const category = guild.channels.cache.get(configData.defaultCategoryId);

        if (!category) {
          categoryValidation = {
            categoryId: configData.defaultCategoryId,
            valid: false,
            error: 'Category not found',
          };
        } else if (category.type !== 4) {
          // CategoryChannel
          categoryValidation = {
            categoryId: configData.defaultCategoryId,
            categoryName: category.name,
            valid: false,
            error: 'Channel is not a category',
          };
        } else {
          categoryValidation = {
            categoryId: configData.defaultCategoryId,
            categoryName: category.name,
            valid: true,
          };
        }
      }

      // Validate log channel
      let logChannelValidation = null;
      if (configData.logChannelId) {
        const logChannel = guild.channels.cache.get(configData.logChannelId);

        if (!logChannel) {
          logChannelValidation = {
            channelId: configData.logChannelId,
            valid: false,
            error: 'Log channel not found',
          };
        } else if (!logChannel.isTextBased()) {
          logChannelValidation = {
            channelId: configData.logChannelId,
            channelName: logChannel.name,
            valid: false,
            error: 'Log channel must be a text channel',
          };
        } else {
          logChannelValidation = {
            channelId: configData.logChannelId,
            channelName: logChannel.name,
            valid: true,
          };
        }
      }

      // Check if any validations failed
      const hasErrors =
        channelValidations.some((v) => !v.valid) ||
        (categoryValidation && !categoryValidation.valid) ||
        (logChannelValidation && !logChannelValidation.valid);

      return response.json({
        success: true,
        valid: !hasErrors,
        data: {
          schema: {
            valid: true,
            message: 'Configuration schema is valid',
          },
          joinChannels: {
            count: channelValidations.length,
            validations: channelValidations,
            allValid: channelValidations.every((v) => v.valid),
          },
          ...(categoryValidation && {
            defaultCategory: categoryValidation,
          }),
          ...(logChannelValidation && {
            logChannel: logChannelValidation,
          }),
        },
        message: hasErrors
          ? 'Configuration validation completed with errors'
          : 'Configuration is valid and can be saved',
      });
    } catch (error) {
      this.container.logger.error('[TempVoice API] Error validating config:', error);

      return response.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while validating the configuration',
        },
      });
    }
  }
}
