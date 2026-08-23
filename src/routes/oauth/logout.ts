import { Route, type ApiRequest, type ApiResponse, HttpCodes } from '@sapphire/plugin-api';
import { deleteJson, CacheKey } from '#lib/cache/typedCache.js';
import { extractSessionId, isSessionId } from '#lib/session.js';

/**
 * OAuth Logout Route
 * Invalidates the server-side session in Redis.
 * Skipped by the authenticated middleware because the URL contains `/oauth/`.
 */
export class OAuthLogoutRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'oauth/logout',
      methods: ['POST'],
    });
  }

  public async run(request: ApiRequest, response: ApiResponse) {
    try {
      const sessionId = extractSessionId(request);

      if (sessionId && isSessionId(sessionId)) {
        await deleteJson(CacheKey.session(sessionId));
      }

      return response.status(HttpCodes.OK).json({ success: true });
    } catch (error) {
      this.container.logger.error('Logout error:', error);
      // Still return success — session will expire via TTL anyway
      return response.status(HttpCodes.OK).json({ success: true });
    }
  }
}
