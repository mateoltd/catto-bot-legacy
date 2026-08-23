import { Route } from '@sapphire/plugin-api';
import { ApiGate } from '#lib/validation/ApiGate.js';
import { RateLimitGate } from '#lib/validation/RateLimitGate.js';
import {
  analyticsService,
  type AnalyticsPeriod,
} from '#modules/moderation/services/AnalyticsService.js';

export class AnalyticsRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/moderation/analytics',
      methods: ['GET'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;
    if (!guildId) return response.status(400).json({ error: 'Guild ID is required' });

    try {
      const gate = await ApiGate.fromRequest(request, guildId);
      if (!gate)
        return response.status(401).json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' });

      // Require mod.evidence.view permission for analytics
      const auth = await gate.checkAuth('mod.evidence.view');
      if (!auth.ok)
        return response
          .status(403)
          .json({ error: 'Forbidden', code: auth.code, metadata: auth.metadata });

      const rateLimitConfig = RateLimitGate.LIMITS['evidence.view'];
      if (!rateLimitConfig) {
        return response
          .status(500)
          .json({ error: 'Missing rate limit configuration for evidence.view' });
      }
      const rateLimit = await gate.checkRateLimit('evidence.view', rateLimitConfig);
      if (!rateLimit.ok)
        return response
          .status(429)
          .json({ error: 'Rate Limited', retryAfterMs: rateLimit.metadata?.retryAfterMs });

      // Parse period from query
      const periodParam = request.query?.period as string | undefined;
      const period: AnalyticsPeriod =
        periodParam === '7d' || periodParam === '30d' || periodParam === '90d'
          ? periodParam
          : '30d';

      const typeParam = request.query?.type as string | undefined;

      if (typeParam === 'cases') {
        const analytics = await analyticsService.getCaseAnalytics(guildId, period);
        return response.json(analytics);
      }

      // Default: evidence analytics
      const analytics = await analyticsService.getAnalytics(guildId, period);
      return response.json(analytics);
    } catch (error) {
      this.container.logger.error('Error fetching analytics:', error);
      return response.status(500).json({ error: 'Internal server error' });
    }
  }
}
