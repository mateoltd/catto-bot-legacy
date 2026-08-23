import { Route } from '@sapphire/plugin-api';
import type { Prisma } from '@prisma/client';
import { parseRequestBody } from '#lib/route-utils.js';

export class GuildConfigRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]',
      methods: ['GET', 'PATCH'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;

    if (!guildId) {
      return response.status(400).json({
        error: 'Guild ID is required',
      });
    }

    if (request.method === 'GET') {
      return this.handleGet(guildId, response);
    } else if (request.method === 'PATCH') {
      return this.handlePatch(guildId, request, response);
    }

    return response.status(405).json({ error: 'Method not allowed' });
  }

  private async handleGet(guildId: string, response: Route.Response) {
    try {
      const guild = await this.container.prisma.guild.findUnique({
        where: { guildId },
      });

      if (!guild) {
        return response.status(404).json({
          error: 'Guild not found',
        });
      }

      // Get Discord guild info
      const discordGuild = this.container.client.guilds.cache.get(guildId);

      return response.json({
        id: guild.guildId,
        name: guild.name,
        language: guild.language,
        settings: guild.settings,
        createdAt: guild.createdAt,
        updatedAt: guild.updatedAt,
        discord: discordGuild
          ? {
              name: discordGuild.name,
              icon: discordGuild.iconURL({ size: 512 }),
              banner: discordGuild.bannerURL({ size: 2048 }),
              splash: discordGuild.splashURL({ size: 2048 }),
              description: discordGuild.description,
              memberCount: discordGuild.memberCount,
              ownerId: discordGuild.ownerId,
              verified: discordGuild.verified,
              premiumTier: discordGuild.premiumTier,
              premiumSubscriptionCount: discordGuild.premiumSubscriptionCount,
              vanityURLCode: discordGuild.vanityURLCode,
            }
          : null,
      });
    } catch (error) {
      this.container.logger.error('Error fetching guild:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }

  private async handlePatch(guildId: string, request: Route.Request, response: Route.Response) {
    try {
      const body = await parseRequestBody(request);

      if (!body || typeof body !== 'object') {
        return response.status(400).json({
          error: 'Request body is required',
        });
      }

      const { language, settings } = body as { language?: string; settings?: unknown };
      const updateData: Prisma.GuildUpdateInput = {};
      if (language) {
        const validLanguages = ['en-US', 'es-ES', 'fr-FR'];
        if (!validLanguages.includes(language)) {
          return response.status(400).json({
            error: 'Invalid language. Valid options: en-US, es-ES, fr-FR',
          });
        }
        updateData.language = language;
      }

      if (settings) {
        updateData.settings = settings as Prisma.InputJsonValue;
      }

      if (Object.keys(updateData).length === 0) {
        return response.status(400).json({
          error: 'No valid update data provided',
        });
      }

      const guild = await this.container.prisma.guild.update({
        where: { guildId },
        data: updateData,
      });

      return response.json({
        message: 'Guild configuration updated',
        guild: {
          id: guild.guildId,
          name: guild.name,
          language: guild.language,
          settings: guild.settings,
          updatedAt: guild.updatedAt,
        },
      });
    } catch (error) {
      this.container.logger.error('Error updating guild:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
