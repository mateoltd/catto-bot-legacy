/**
 * DELETE /api/guilds/[guildId]/temp-voice/moderation/patterns/[patternId]
 * Delete a global moderation pattern
 */

import { Route } from '@sapphire/plugin-api';
import { ApiGate } from '#lib/validation/ApiGate.js';

export class TempVoiceModerationPatternsDeleteRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/temp-voice/moderation/patterns/[patternId]',
      methods: ['DELETE'],
    });
  }

  public run(request: Route.Request, response: Route.Response) {
    return this.handleDelete(request, response);
  }

  private async handleDelete(request: Route.Request, response: Route.Response) {
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

      // Delete pattern
      await this.container.prisma.tempVoiceModerationPattern.delete({
        where: { id: patternId },
      });

      return response.json({
        success: true,
        data: {
          message: 'Pattern deleted successfully',
          deletedPattern: {
            id: pattern.id,
            pattern: pattern.pattern,
            patternType: pattern.patternType,
          },
        },
      });
    } catch (error) {
      this.container.logger.error('[Moderation API] Error deleting pattern:', error);

      return response.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete pattern',
        },
      });
    }
  }
}
