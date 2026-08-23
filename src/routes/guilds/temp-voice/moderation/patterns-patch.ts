/**
 * PATCH /api/guilds/[guildId]/temp-voice/moderation/patterns/[patternId]
 * Update a global moderation pattern (toggle enabled/disabled)
 */

import { Route } from '@sapphire/plugin-api';
import type { Prisma } from '@prisma/client';
import { RouteRequestWithBody } from '#root/lib/route-types.js';
import { ApiGate } from '#lib/validation/ApiGate.js';

interface UpdatePatternBody {
  enabled?: boolean;
  description?: string;
}

export class TempVoiceModerationPatternsPatchRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/temp-voice/moderation/patterns/[patternId]',
      methods: ['PATCH'],
    });
  }

  public run(request: Route.Request, response: Route.Response) {
    return this.handlePatch(request as RouteRequestWithBody, response);
  }

  private async handlePatch(request: RouteRequestWithBody, response: Route.Response) {
    try {
      const guildId = request.params.guildId;
      const patternId = request.params.patternId;

      if (!guildId || !patternId) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Guild ID and Pattern ID are required',
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

      const body = request.body as UpdatePatternBody;

      // Check if pattern exists
      const pattern = await this.container.prisma.tempVoiceModerationPattern.findUnique({
        where: { id: patternId },
      });

      if (!pattern) {
        return response.status(404).json({
          success: false,
          error: {
            code: 'PATTERN_NOT_FOUND',
            message: 'Pattern not found',
          },
        });
      }

      // Build update data
      const updateData: Prisma.TempVoiceModerationPatternUpdateInput = {};
      if (body.enabled !== undefined) {
        updateData.enabled = body.enabled;
      }
      if (body.description !== undefined) {
        updateData.description = body.description;
      }

      if (Object.keys(updateData).length === 0) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'NO_UPDATES',
            message: 'No valid fields to update',
          },
        });
      }

      // Update pattern
      const updatedPattern = await this.container.prisma.tempVoiceModerationPattern.update({
        where: { id: patternId },
        data: updateData,
      });

      return response.json({
        success: true,
        data: {
          id: updatedPattern.id,
          pattern: updatedPattern.pattern,
          patternType: updatedPattern.patternType,
          description: updatedPattern.description,
          severity: updatedPattern.severity,
          enabled: updatedPattern.enabled,
          createdAt: updatedPattern.createdAt,
          updatedAt: updatedPattern.updatedAt,
        },
      });
    } catch (error) {
      this.container.logger.error('[Moderation API] Error updating pattern:', error);

      return response.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update pattern',
        },
      });
    }
  }
}
