import { Route } from '@sapphire/plugin-api';
import { ApiGate } from '#lib/validation/ApiGate.js';
import { exportService } from '#modules/moderation/services/ExportService.js';

export class CaseExportRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/moderation/cases/[caseNumber]/export',
      methods: ['POST'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId, caseNumber: caseNumberStr } = request.params;
    if (!guildId || !caseNumberStr) {
      return response.status(400).json({ error: 'Guild ID and Case Number are required' });
    }

    const caseNumber = parseInt(caseNumberStr, 10);
    if (isNaN(caseNumber) || caseNumber < 1) {
      return response.status(400).json({ error: 'Invalid case number' });
    }

    const gate = await ApiGate.fromRequest(request, guildId);
    if (!gate) {
      return response.status(401).json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' });
    }

    const auth = await gate.checkAuth('mod.cases.view');
    if (!auth.ok) {
      return response.status(403).json({ error: 'Forbidden', code: auth.code });
    }

    // Rate limit: 1 export per minute per user
    const rateLimit = await gate.checkRateLimit('cases.export', {
      maxRequests: 1,
      windowMs: 60_000,
    });
    if (!rateLimit.ok) {
      return response
        .status(429)
        .json({ error: 'Rate Limited', retryAfterMs: rateLimit.metadata?.retryAfterMs });
    }

    try {
      const result = await exportService.exportCase(
        guildId,
        caseNumber,
        gate.userId,
        gate.member.user.tag
      );
      return response.json(result);
    } catch (error) {
      this.container.logger.error('Error exporting case:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      return response.status(500).json({ error: message });
    }
  }
}
