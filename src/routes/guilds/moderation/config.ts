import { Route } from '@sapphire/plugin-api';
import { parseRequestBody } from '#lib/route-utils.js';
import { validateDto } from '#lib/validation/validate-dto.js';
import { UpdateModConfigDto } from '#lib/dtos/moderation/moderation-config.dto.js';

export class ModerationConfigRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/moderation/config',
      methods: ['GET', 'PUT', 'PATCH'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;

    if (!guildId) {
      return response.status(400).json({
        error: 'Guild ID is required',
      });
    }

    // Verify guild exists in cache
    const discordGuild = this.container.client.guilds.cache.get(guildId);
    if (!discordGuild) {
      return response.status(404).json({
        error: 'Guild not found or bot is not in the guild',
      });
    }

    if (request.method === 'GET') {
      return this.handleGet(guildId, response);
    } else if (request.method === 'PUT' || request.method === 'PATCH') {
      return this.handleUpdate(guildId, request, response);
    }

    return response.status(405).json({ error: 'Method not allowed' });
  }

  private async handleGet(guildId: string, response: Route.Response) {
    try {
      const config = await this.container.prisma.modConfig.findUnique({
        where: { guildId },
      });

      if (!config) {
        // Return default config if not set
        return response.json({
          guildId,
          modLogChannelId: null,
          muteRoleId: null,
          autoModEnabled: false,
          watermarkDownloads: true,
          watermarkText: null,
          createdAt: null,
          updatedAt: null,
        });
      }

      return response.json(config);
    } catch (error) {
      this.container.logger.error('Error fetching moderation config:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }

  private async handleUpdate(guildId: string, request: Route.Request, response: Route.Response) {
    try {
      const body = await parseRequestBody(request);

      // Validate request body
      const validation = await validateDto(UpdateModConfigDto, body);
      if (!validation.success) {
        return response.status(400).json({
          error: 'Validation failed',
          details: validation.errors,
        });
      }

      if (!validation.data) {
        return response.status(400).json({ error: 'Invalid request data' });
      }

      const config = validation.data;

      // Validate channel exists if provided
      if (config.modLogChannelId) {
        const guild = this.container.client.guilds.cache.get(guildId);
        const channel = guild?.channels.cache.get(config.modLogChannelId);
        if (!channel || !channel.isTextBased()) {
          return response.status(400).json({
            error: 'Invalid channel ID or channel is not text-based',
          });
        }
      }

      // Validate role exists if provided
      if (config.muteRoleId) {
        const guild = this.container.client.guilds.cache.get(guildId);
        const role = guild?.roles.cache.get(config.muteRoleId);
        if (!role) {
          return response.status(400).json({
            error: 'Invalid role ID',
          });
        }
      }

      // Upsert config
      // Note: Prisma schema defines defaults (watermarkDownloads: true, autoModEnabled: false)
      // so we only need to pass fields that were explicitly provided
      const updatedConfig = await this.container.prisma.modConfig.upsert({
        where: { guildId },
        update: {
          ...(config.modLogChannelId !== undefined && { modLogChannelId: config.modLogChannelId }),
          ...(config.muteRoleId !== undefined && { muteRoleId: config.muteRoleId }),
          ...(config.autoModEnabled !== undefined && { autoModEnabled: config.autoModEnabled }),
          ...(config.watermarkDownloads !== undefined && {
            watermarkDownloads: config.watermarkDownloads,
          }),
          ...(config.watermarkText !== undefined && { watermarkText: config.watermarkText }),
          updatedAt: new Date(),
        },
        create: {
          guildId,
          ...(config.modLogChannelId !== undefined && { modLogChannelId: config.modLogChannelId }),
          ...(config.muteRoleId !== undefined && { muteRoleId: config.muteRoleId }),
          ...(config.autoModEnabled !== undefined && { autoModEnabled: config.autoModEnabled }),
          ...(config.watermarkDownloads !== undefined && {
            watermarkDownloads: config.watermarkDownloads,
          }),
          ...(config.watermarkText !== undefined && { watermarkText: config.watermarkText }),
        },
      });

      return response.json(updatedConfig);
    } catch (error) {
      this.container.logger.error('Error updating moderation config:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
