import { Route, type ApiRequest, type ApiResponse, HttpCodes } from '@sapphire/plugin-api';
import axios from 'axios';
import { createHash } from 'node:crypto';
import { getOrSetJson, CacheKey } from '#lib/cache/typedCache.js';
import { extractSessionId, isSessionId, resolveSession } from '#lib/session.js';
import { z } from 'zod';

const discordUserSchema = z.object({ id: z.string() }).passthrough();
const discordGuildsSchema = z.array(z.object({ id: z.string() }).passthrough());

/**
 * Get current authenticated user information
 * This route requires authentication via the authenticated middleware
 */
export class UserMeRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'users/@me',
      methods: ['GET'],
    });
  }

  public async run(request: ApiRequest, response: ApiResponse) {
    const value = extractSessionId(request);

    if (!value) {
      return response.status(HttpCodes.Unauthorized).json({
        error: 'Unauthorized',
        message: 'You must be logged in to access this resource',
      });
    }

    try {
      let accessToken: string;

      // New path: session ID → resolve accessToken from Redis
      if (isSessionId(value)) {
        const session = await resolveSession(value);
        if (!session) {
          return response.status(HttpCodes.Unauthorized).json({
            error: 'SessionExpired',
            message: 'Your session has expired. Please log in again.',
          });
        }
        accessToken = session.accessToken;
      } else {
        // Legacy path: raw Discord token
        accessToken = value;
      }

      const tokenHash = createHash('sha256').update(accessToken).digest('hex').slice(0, 16);

      // Fetch user data from Discord API (cached for 60s by token hash)
      let userData: Record<string, unknown>;
      try {
        userData = await getOrSetJson(
          CacheKey.discordUser(tokenHash),
          discordUserSchema,
          async () => {
            const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (userResponse.status !== 200) throw new Error('Discord API returned non-200');
            return userResponse.data;
          },
          60
        );
      } catch {
        // Redis unavailable — fall back to direct call
        const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (userResponse.status !== 200) {
          return response.status(HttpCodes.InternalServerError).json({
            error: 'Failed to fetch user data from Discord',
          });
        }
        userData = userResponse.data;
      }

      // Optionally fetch guilds (cached for 60s by token hash)
      let guilds: Array<Record<string, unknown>> = [];
      try {
        guilds = await getOrSetJson(
          CacheKey.discordGuilds(tokenHash),
          discordGuildsSchema,
          async () => {
            const guildsResponse = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (guildsResponse.status !== 200) throw new Error('Discord API returned non-200');
            return guildsResponse.data;
          },
          60
        );
      } catch (error) {
        // Guilds are optional, don't fail if we can't fetch them (Redis or Discord failure)
        this.container.logger.warn('Failed to fetch user guilds:', error);
      }

      // Return user data
      return response.json({
        user: {
          id: userData.id,
          username: userData.username,
          discriminator: userData.discriminator,
          avatar: userData.avatar,
          email: userData.email,
          verified: userData.verified,
          mfa_enabled: userData.mfa_enabled,
          locale: userData.locale,
          flags: userData.flags,
          premium_type: userData.premium_type,
          public_flags: userData.public_flags,
        },
        guilds: guilds.map((guild) => ({
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          owner: guild.owner,
          permissions: guild.permissions,
          features: guild.features,
        })),
      });
    } catch (error) {
      this.container.logger.error('Error fetching user data:', error);
      return response.status(HttpCodes.InternalServerError).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch user data',
      });
    }
  }
}
