/**
 * PATCH /api/guilds/[guildId]/temp-voice/moderation/keywords/[keywordId]
 * Approve, deny, or ignore a keyword
 */

import { Route } from '@sapphire/plugin-api';
import { RouteRequestWithBody } from '#root/lib/route-types.js';
import { KeywordQueueService } from '#modules/temp-voice/services/moderation/keyword-queue.service.js';
import { ApiGate } from '#lib/validation/ApiGate.js';

interface KeywordActionBody {
  action: 'approve' | 'deny' | 'ignore';
  reviewNote?: string;
}

export class TempVoiceModerationKeywordsPatchRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/temp-voice/moderation/keywords/[keywordId]',
      methods: ['PATCH'],
    });
  }

  public run(request: Route.Request, response: Route.Response) {
    return this.handlePatch(request as RouteRequestWithBody, response);
  }

  private async handlePatch(request: RouteRequestWithBody, response: Route.Response) {
    try {
      const guildId = request.params.guildId;
      const keywordId = request.params.keywordId;

      if (!guildId || !keywordId) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Guild ID and Keyword ID are required',
          },
        });
      }

      const gate = await ApiGate.fromRequest(request, guildId);
      if (!gate) {
        return response.status(401).json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' });
      }
      const auth = await gate.checkAuth('tempvoice.moderation');
      if (!auth.ok) {
        return response.status(403).json({ error: 'Forbidden', code: auth.code });
      }

      const body = request.body as KeywordActionBody;

      if (!body.action || !['approve', 'deny', 'ignore'].includes(body.action)) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ACTION',
            message: 'Action must be one of: approve, deny, ignore',
          },
        });
      }

      const reviewedBy = gate.userId;

      const keywordQueueService = new KeywordQueueService(this.container.prisma);

      let result;
      try {
        switch (body.action) {
          case 'approve':
            result = await keywordQueueService.approveKeyword(
              keywordId,
              reviewedBy,
              body.reviewNote || undefined
            );
            break;
          case 'deny':
            result = await keywordQueueService.denyKeyword(
              keywordId,
              reviewedBy,
              body.reviewNote || undefined
            );
            break;
          case 'ignore':
            result = await keywordQueueService.ignoreKeyword(keywordId, reviewedBy);
            break;
        }
      } catch (error) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'ACTION_FAILED',
            message: error instanceof Error ? error.message : 'Failed to process action',
          },
        });
      }

      return response.json({
        success: true,
        data: {
          keyword: result.keyword,
          action: body.action,
          patternId: result.patternId,
          reviewedBy,
        },
      });
    } catch (error) {
      this.container.logger.error('[Moderation API] Error updating keyword:', error);

      return response.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update keyword',
        },
      });
    }
  }
}
