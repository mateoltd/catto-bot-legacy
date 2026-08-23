import { Route } from '@sapphire/plugin-api';
import { validateDto } from '#lib/validation/validate-dto.js';
import { IgnoredChannelsDto } from '#lib/dtos/logging/logging-config.dto.js';

interface AddRemoveChannelRequest {
  channelId: string;
}

export class LoggingIgnoredChannelsRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/logging/ignored-channels',
      methods: ['GET', 'PUT', 'POST', 'DELETE'],
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
    const guild = this.container.client.guilds.cache.get(guildId);
    if (!guild) {
      return response.status(404).json({
        error: 'Guild not found or bot is not in the guild',
      });
    }

    // Check if logging config exists
    const config = await this.container.prisma.logConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return response.status(404).json({
        error: 'Logging system not set up. Use POST /guilds/:guildId/logging/setup first',
      });
    }

    switch (request.method) {
      case 'GET':
        return this.handleGet(config, response);
      case 'PUT':
        return this.handlePut(guildId, request, response);
      case 'POST':
        return this.handlePost(guildId, config, request, response);
      case 'DELETE':
        return this.handleDelete(guildId, config, request, response);
      default:
        return response.status(405).json({ error: 'Method not allowed' });
    }
  }

  /**
   * GET - Get list of ignored channels
   */
  private async handleGet(
    config: NonNullable<Awaited<ReturnType<typeof this.container.prisma.logConfig.findUnique>>>,
    response: Route.Response
  ) {
    return response.json({
      ignoredChannels: config.ignoredChannels,
      count: config.ignoredChannels.length,
    });
  }

  /**
   * PUT - Replace entire ignored channels list
   */
  private async handlePut(guildId: string, request: Route.Request, response: Route.Response) {
    try {
      const body = await request.readBodyJson();

      // Validate request body
      const validation = await validateDto(IgnoredChannelsDto, body);
      if (!validation.success) {
        return response.status(400).json({
          error: 'Validation failed',
          details: validation.errors,
        });
      }

      if (!validation.data) {
        return response.status(400).json({ error: 'Invalid request data' });
      }

      const { channelIds } = validation.data;

      // Validate all channel IDs
      const guild = this.container.client.guilds.cache.get(guildId);
      if (guild) {
        const invalidChannels = channelIds.filter((id: string) => !guild.channels.cache.has(id));

        if (invalidChannels.length > 0) {
          return response.status(400).json({
            error: 'Some channel IDs are invalid or not found in guild',
            invalidChannels,
          });
        }
      }

      const config = await this.container.prisma.logConfig.update({
        where: { guildId },
        data: {
          ignoredChannels: channelIds,
          updatedAt: new Date(),
        },
      });

      return response.json({
        success: true,
        ignoredChannels: config.ignoredChannels,
        count: config.ignoredChannels.length,
      });
    } catch (error) {
      this.container.logger.error('Error updating ignored channels:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }

  /**
   * POST - Add a channel to ignored list
   */
  private async handlePost(
    guildId: string,
    config: NonNullable<Awaited<ReturnType<typeof this.container.prisma.logConfig.findUnique>>>,
    request: Route.Request,
    response: Route.Response
  ) {
    try {
      const body = (await request.readBodyJson()) as AddRemoveChannelRequest;

      if (!body?.channelId) {
        return response.status(400).json({
          error: 'channelId is required',
        });
      }

      // Check if channel exists in guild
      const guild = this.container.client.guilds.cache.get(guildId);
      if (guild && !guild.channels.cache.has(body.channelId)) {
        return response.status(400).json({
          error: 'Channel not found in guild',
        });
      }

      // Check if already ignored
      if (config.ignoredChannels.includes(body.channelId)) {
        return response.json({
          success: true,
          message: 'Channel is already ignored',
          ignoredChannels: config.ignoredChannels,
          count: config.ignoredChannels.length,
        });
      }

      const updatedConfig = await this.container.prisma.logConfig.update({
        where: { guildId },
        data: {
          ignoredChannels: {
            push: body.channelId,
          },
          updatedAt: new Date(),
        },
      });

      return response.json({
        success: true,
        message: 'Channel added to ignored list',
        ignoredChannels: updatedConfig.ignoredChannels,
        count: updatedConfig.ignoredChannels.length,
      });
    } catch (error) {
      this.container.logger.error('Error adding ignored channel:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }

  /**
   * DELETE - Remove a channel from ignored list
   */
  private async handleDelete(
    guildId: string,
    config: NonNullable<Awaited<ReturnType<typeof this.container.prisma.logConfig.findUnique>>>,
    request: Route.Request,
    response: Route.Response
  ) {
    try {
      const body = (await request.readBodyJson()) as AddRemoveChannelRequest;

      if (!body?.channelId) {
        return response.status(400).json({
          error: 'channelId is required',
        });
      }

      // Check if channel is in ignored list
      if (!config.ignoredChannels.includes(body.channelId)) {
        return response.json({
          success: true,
          message: 'Channel is not in ignored list',
          ignoredChannels: config.ignoredChannels,
          count: config.ignoredChannels.length,
        });
      }

      const updatedChannels = config.ignoredChannels.filter((id) => id !== body.channelId);

      const updatedConfig = await this.container.prisma.logConfig.update({
        where: { guildId },
        data: {
          ignoredChannels: updatedChannels,
          updatedAt: new Date(),
        },
      });

      return response.json({
        success: true,
        message: 'Channel removed from ignored list',
        ignoredChannels: updatedConfig.ignoredChannels,
        count: updatedConfig.ignoredChannels.length,
      });
    } catch (error) {
      this.container.logger.error('Error removing ignored channel:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
