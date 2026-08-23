import { ApiRequest, ApiResponse, Middleware, type MiddlewareOptions } from '@sapphire/plugin-api';
import type { RESTGetAPICurrentUserGuildsResult } from 'discord-api-types/v10';
import axios from 'axios';

// Augment the ApiRequest type to include guildAccess
declare module '@sapphire/plugin-api' {
  interface ApiRequest {
    guildAccess?: {
      hasAccess: boolean;
      isAdmin: boolean;
    };
  }
}

/**
 * Middleware to verify that the authenticated user has access to the guild
 * Requires the authenticated middleware to run first
 */
export class GuildAccessMiddleware extends Middleware {
  public constructor(context: Middleware.LoaderContext, options: MiddlewareOptions) {
    super(context, {
      ...options,
      position: 30, // Run after authenticated middleware
    });
  }

  public override async run(request: ApiRequest, response: ApiResponse): Promise<void> {
    // Skip if no auth (let authenticated middleware handle it)
    if (!request.auth) {
      return;
    }

    // Extract guild ID from route params
    const guildId = request.params.guildId;

    if (!guildId) {
      // Not a guild-specific route, skip this middleware
      return;
    }

    try {
      // Fetch user's guilds from Discord API using the OAuth token
      const guilds = await this.fetchUserGuilds(request.auth.token);

      // Check if user has access to this guild
      const hasAccess = guilds.some((guild) => guild.id === guildId);

      if (!hasAccess) {
        response.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this guild',
        });
        return;
      }

      // Optional: Check if user has admin permissions in the guild
      // You can add more granular permission checks here
      const userGuild = guilds.find((guild) => guild.id === guildId);
      const hasAdminPermissions = userGuild
        ? (BigInt(userGuild.permissions) & 0x8n) === 0x8n
        : false;

      // Store guild access info in request for use in routes
      request.guildAccess = {
        hasAccess: true,
        isAdmin: hasAdminPermissions,
      };
    } catch (error) {
      this.container.logger.error('Error checking guild access:', error);
      response.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to verify guild access',
      });
      return;
    }
  }

  private async fetchUserGuilds(token: string): Promise<RESTGetAPICurrentUserGuildsResult> {
    const response = await axios.get<RESTGetAPICurrentUserGuildsResult>(
      'https://discord.com/api/v10/users/@me/guilds',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  }
}
