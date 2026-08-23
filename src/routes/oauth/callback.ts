import { Route, type ApiRequest, type ApiResponse, HttpCodes } from '@sapphire/plugin-api';
import axios from 'axios';
import { URLSearchParams } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setJson, SessionDataSchema, CacheKey, encryptSessionData } from '#lib/cache/typedCache.js';

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * OAuth Callback Route
 * Handles Discord OAuth2 callback and exchanges code for access token,
 * then creates a server-side session in Redis and redirects to dashboard.
 */
export class OAuthCallbackRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'oauth/callback',
      methods: ['GET'],
    });
  }

  public async run(request: ApiRequest, response: ApiResponse) {
    const { server } = this.container;

    if (!server.auth) {
      return response.status(HttpCodes.InternalServerError).json({
        error: 'OAuth is not configured',
      });
    }

    // Get the authorization code from query params
    const code = request.query.code as string;

    if (!code) {
      return response.status(HttpCodes.BadRequest).json({
        error: 'Missing authorization code',
      });
    }

    if (!server.auth.id || !server.auth.secret || !server.auth.redirect) {
      return response.status(HttpCodes.InternalServerError).json({
        error: 'OAuth configuration is incomplete',
      });
    }

    try {
      // Exchange code for access token
      const tokenResponse = await axios.post(
        'https://discord.com/api/v10/oauth2/token',
        new URLSearchParams({
          client_id: server.auth.id,
          client_secret: server.auth.secret,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: server.auth.redirect,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token } = tokenResponse.data;

      // Fetch user identity from Discord
      const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
        validateStatus: () => true,
      });

      if (userResponse.status !== 200 || !userResponse.data?.id) {
        this.container.logger.error('OAuth callback: failed to fetch Discord user identity');
        return response.status(HttpCodes.InternalServerError).json({
          error: 'Failed to verify user identity with Discord',
        });
      }

      const userId: string = userResponse.data.id;

      // Generate opaque session ID and store in Redis
      const sessionId = randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

      const sessionData = {
        accessToken: access_token,
        refreshToken: refresh_token,
        userId,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      await setJson(
        CacheKey.session(sessionId),
        SessionDataSchema,
        encryptSessionData(sessionData),
        SESSION_TTL_SECONDS
      );

      // Redirect to dashboard with sessionId (not raw token)
      const redirectUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
      const callbackUrl = `${redirectUrl}/api/auth/callback?sessionId=${encodeURIComponent(sessionId)}`;

      return response.status(302).setHeader('Location', callbackUrl).text('');
    } catch (error) {
      this.container.logger.error('OAuth callback error:', error);
      return response.status(HttpCodes.InternalServerError).json({
        error: 'Failed to complete OAuth flow',
      });
    }
  }
}
