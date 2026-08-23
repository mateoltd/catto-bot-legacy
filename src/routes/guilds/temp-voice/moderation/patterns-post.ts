/**
 * POST /api/guilds/[guildId]/temp-voice/moderation/patterns
 * Create a new global moderation pattern (admin only)
 */

import { Route } from '@sapphire/plugin-api';
import { RouteRequestWithBody } from '#root/lib/route-types.js';
import { ApiGate } from '#lib/validation/ApiGate.js';

interface CreatePatternBody {
  pattern: string;
  patternType: string;
  description?: string;
  severity?: number;
}

export class TempVoiceModerationPatternsPostRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/temp-voice/moderation/patterns',
      methods: ['POST'],
    });
  }

  public run(request: Route.Request, response: Route.Response) {
    return this.handlePost(request as RouteRequestWithBody, response);
  }

  private async handlePost(request: RouteRequestWithBody, response: Route.Response) {
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

      const body = request.body as CreatePatternBody;

      // Validate required fields
      if (!body.pattern || !body.patternType) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'pattern and patternType are required',
          },
        });
      }

      // Validate pattern is valid regex
      try {
        new RegExp(body.pattern, 'gi');
      } catch (error) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PATTERN',
            message: `Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        });
      }

      // Validate type
      const validTypes = [
        'PROFANITY',
        'HATE_SPEECH',
        'HARASSMENT',
        'NSFW',
        'SPAM',
        'OBFUSCATION',
        'OTHER',
      ];
      if (!validTypes.includes(body.patternType)) {
        return response.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TYPE',
            message: `patternType must be one of: ${validTypes.join(', ')}`,
          },
        });
      }

      // Create global pattern
      const pattern = await this.container.prisma.tempVoiceModerationPattern.create({
        data: {
          pattern: body.pattern,
          patternType: body.patternType,
          description: body.description || `Custom ${body.patternType} pattern`,
          severity: body.severity || 5,
          enabled: true,
          caseInsensitive: true,
        },
      });

      return response.status(201).json({
        success: true,
        data: {
          id: pattern.id,
          pattern: pattern.pattern,
          patternType: pattern.patternType,
          description: pattern.description,
          severity: pattern.severity,
          enabled: pattern.enabled,
          createdAt: pattern.createdAt,
        },
      });
    } catch (error) {
      this.container.logger.error('[Moderation API] Error creating pattern:', error);

      return response.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create pattern',
        },
      });
    }
  }
}
