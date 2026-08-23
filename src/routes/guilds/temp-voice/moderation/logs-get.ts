/**
 * GET /api/guilds/[guildId]/temp-voice/moderation/logs
 * Retrieve moderation logs for a guild
 */

import { Route } from '@sapphire/plugin-api';
import type { Prisma } from '@prisma/client';
import { ApiGate } from '#lib/validation/ApiGate.js';

export class TempVoiceModerationLogsGetRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/temp-voice/moderation/logs',
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
      const action = request.query.action as string | undefined;
      const channelId = request.query.channelId as string | undefined;
      const userId = request.query.userId as string | undefined;
      const limit = request.query.limit ? parseInt(request.query.limit as string, 10) : 50;
      const offset = request.query.offset ? parseInt(request.query.offset as string, 10) : 0;

      // Build filter
      const where: Prisma.TempVoiceModerationLogWhereInput = { guildId };
      if (action) where.actionTaken = action;
      if (channelId) where.channelId = channelId;
      if (userId) where.userId = userId;

      // Get logs from database
      const logs = await this.container.prisma.tempVoiceModerationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      // Get total count for pagination
      const total = await this.container.prisma.tempVoiceModerationLog.count({ where });

      return response.json({
        success: true,
        data: {
          logs: logs.map((log) => ({
            id: log.id,
            guildId: log.guildId,
            channelId: log.channelId,
            userId: log.userId,
            actionTaken: log.actionTaken,
            originalName: log.originalName,
            finalName: log.finalName,
            reasonCodes: log.reasonCodes,
            matchedPatterns: log.matchedPatterns,
            heuristicScore: log.heuristicScore,
            createdAt: log.createdAt,
          })),
          pagination: {
            limit,
            offset,
            total,
            hasMore: offset + limit < total,
          },
        },
      });
    } catch (error) {
      this.container.logger.error('[Moderation API] Error fetching logs:', error);

      return response.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch logs',
        },
      });
    }
  }
}
