import { Route, type ApiRequest, type ApiResponse } from '@sapphire/plugin-api';
import { URL } from 'node:url';

/**
 * OAuth Login Route
 * Initiates Discord OAuth2 flow by redirecting to Discord's authorization page
 */
export class OAuthLoginRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'oauth/login',
      methods: ['GET'],
    });
  }

  public async run(_request: ApiRequest, response: ApiResponse) {
    const { server } = this.container;

    if (!server.auth) {
      return response.status(500).json({
        error: 'OAuth is not configured',
      });
    }

    if (!server.auth.id || !server.auth.redirect || !server.auth.scopes) {
      return response.status(500).json({
        error: 'OAuth configuration is incomplete',
      });
    }

    // Generate state for CSRF protection
    const state = this.generateState();

    // Build Discord OAuth2 URL
    const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
    discordAuthUrl.searchParams.set('client_id', server.auth.id);
    discordAuthUrl.searchParams.set('redirect_uri', server.auth.redirect);
    discordAuthUrl.searchParams.set('response_type', 'code');
    discordAuthUrl.searchParams.set('scope', server.auth.scopes.join(' '));
    discordAuthUrl.searchParams.set('state', state);

    // Redirect to Discord using proper Sapphire method
    return response.status(302).setHeader('Location', discordAuthUrl.toString()).text('');
  }

  private generateState(): string {
    // Generate a random state string for CSRF protection
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }
}
