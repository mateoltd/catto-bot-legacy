/**
 * GET /api/guilds/[guildId]/temp-voice/moderation/keywords
 * Retrieve pending keywords from the review queue
 */

import { Route } from '@sapphire/plugin-api';
import { KeywordApprovalStatus } from '@prisma/client';
import {
  KeywordQueueService,
  KeywordSource,
} from '#modules/temp-voice/services/moderation/keyword-queue.service.js';
import { ApiGate } from '#lib/validation/ApiGate.js';

export class TempVoiceModerationKeywordsGetRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/temp-voice/moderation/keywords',
      methods: ['GET'],
    });
  }

  public run(request: Route.Request, response: Route.Response) {
    return this.handleGet(request, response);
  }

  private async handleGet(request: Route.Request, response: Route.Response) {
    try {
      const guildId = request.params.guildId;

      if (!guildId) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'MISSING_GUILD_ID',
            message: 'Guild ID is required',
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

      // Parse query parameters
      const status = request.query.status as string | undefined;
      const source = request.query.source as string | undefined;
      const minOccurrences = request.query.minOccurrences
        ? parseInt(request.query.minOccurrences as string, 10)
        : undefined;
      const limit = request.query.limit ? parseInt(request.query.limit as string, 10) : 50;
      const offset = request.query.offset ? parseInt(request.query.offset as string, 10) : 0;

      // Get keywords from service
      const keywordQueueService = new KeywordQueueService(this.container.prisma);
      const keywords = await keywordQueueService.getPendingKeywords(guildId, {
        status: status as KeywordApprovalStatus | undefined,
        source: source as KeywordSource | undefined,
        minOccurrences,
        limit,
        offset,
      });

      // Get stats as well
      const stats = await keywordQueueService.getQueueStats(guildId);

      return response.json({
        success: true,
        data: {
          keywords: keywords.map((k) => ({
            id: k.id,
            keyword: k.keyword,
            normalizedKeyword: k.normalizedKeyword,
            source: k.source,
            status: k.status,
            occurrences: k.occurrences,
            contextSnippet: k.contextSnippet,
            channelId: k.channelId,
            userId: k.userId,
            lastSeenAt: k.lastSeenAt,
            reviewedBy: k.reviewedBy,
            reviewedAt: k.reviewedAt,
            reviewNote: k.reviewNote,
            createdAt: k.createdAt,
            updatedAt: k.updatedAt,
          })),
          stats,
          pagination: {
            limit,
            offset,
            total: keywords.length,
          },
        },
      });
    } catch (error) {
      this.container.logger.error('[Moderation API] Error fetching keywords:', error);

      return response.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch keywords',
        },
      });
    }
  }
}
