import { ApiRequest, ApiResponse, Middleware, type MiddlewareOptions } from '@sapphire/plugin-api';
import { extractSessionId, isSessionId, resolveSession } from '#lib/session.js';
import { URL } from 'node:url';

/**
 * Middleware to ensure a user is authenticated via a server-side session.
 *
 * - Raw Discord tokens (non-UUID values) are rejected with SessionExpired
 *   to force re-login through the new session flow.
 * - Valid session IDs are verified against Redis.
 */
export class AuthenticatedMiddleware extends Middleware {
  public constructor(context: Middleware.LoaderContext, options: MiddlewareOptions) {
    super(context, {
      ...options,
      position: 20, // Run after body parsing (10) but before route handlers
    });
  }

  public override async run(request: ApiRequest, response: ApiResponse): Promise<void> {
    // Skip authentication for OAuth routes (check pathname only, not query string)
    try {
      const pathname = new URL(request.url ?? '', 'http://localhost').pathname;
      if (pathname.includes('/oauth/')) {
        return;
      }
    } catch {
      // If URL parsing fails, do not skip auth
    }

    const value = extractSessionId(request);

    if (!value) {
      response.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to access this resource',
      });
      return;
    }

    // Reject legacy raw tokens — force re-login
    if (!isSessionId(value)) {
      response.status(401).json({
        error: 'SessionExpired',
        message: 'Your session has expired. Please log in again.',
      });
      return;
    }

    // Validate session exists and is not expired
    const session = await resolveSession(value);
    if (!session) {
      response.status(401).json({
        error: 'SessionExpired',
        message: 'Your session has expired. Please log in again.',
      });
      return;
    }

    // Authentication successful, continue to next middleware/route
  }
}
