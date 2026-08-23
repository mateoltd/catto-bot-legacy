import { Route } from '@sapphire/plugin-api';
import { ApiGate } from '#lib/validation/ApiGate.js';
import { RateLimitGate } from '#lib/validation/RateLimitGate.js';
import { caseNoteService } from '#modules/moderation/services/CaseNoteService.js';
import { parseRequestBody } from '#lib/route-utils.js';

export class CaseNotesRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/moderation/cases/[caseNumber]/notes',
      methods: ['GET', 'POST'],
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

    try {
      // Find the case
      const modCase = await this.container.prisma.modCase.findFirst({
        where: { guildId, caseNumber },
      });
      if (!modCase) {
        return response.status(404).json({ error: 'Case not found' });
      }

      if (request.method === 'GET') {
        return this.handleGet(gate, modCase.id, request, response);
      }

      if (request.method === 'POST') {
        return this.handlePost(gate, modCase.id, guildId, request, response);
      }

      return response.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      this.container.logger.error('Error in case notes route:', error);
      return response.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleGet(
    gate: ApiGate,
    caseId: string,
    request: Route.Request,
    response: Route.Response
  ) {
    const auth = await gate.checkAuth('mod.cases.view');
    if (!auth.ok) {
      return response.status(403).json({ error: 'Forbidden', code: auth.code });
    }

    const rateLimit = await gate.checkRateLimit(
      'cases.notes.view',
      RateLimitGate.LIMITS['evidence.view']!
    );
    if (!rateLimit.ok) {
      return response
        .status(429)
        .json({ error: 'Rate Limited', retryAfterMs: rateLimit.metadata?.retryAfterMs });
    }

    const page = parseInt((request.query?.page as string) ?? '1');
    const limit = parseInt((request.query?.limit as string) ?? '50');

    const result = await caseNoteService.getNotes(caseId, { page, limit });
    return response.json(result);
  }

  private async handlePost(
    gate: ApiGate,
    caseId: string,
    guildId: string,
    request: Route.Request,
    response: Route.Response
  ) {
    const auth = await gate.checkAuth('mod.cases.edit');
    if (!auth.ok) {
      return response.status(403).json({ error: 'Forbidden', code: auth.code });
    }

    const body = ((await parseRequestBody(request)) ?? {}) as Record<string, unknown>;
    const content = (body.content as string)?.trim();

    if (!content) {
      return response.status(400).json({ error: 'content is required' });
    }

    if (content.length > 2000) {
      return response.status(400).json({ error: 'content must be 2000 characters or fewer' });
    }

    const note = await caseNoteService.addNote({
      caseId,
      guildId,
      authorId: gate.userId,
      authorTag: gate.member.user.tag,
      content,
    });

    return response.status(201).json(note);
  }
}
