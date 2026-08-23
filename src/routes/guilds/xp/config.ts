import { configService } from '#root/modules/xp/xp-text/index.js';
import { Route } from '@sapphire/plugin-api';
import { parseRequestBody } from '#lib/route-utils.js';
import { validateDto } from '#lib/validation/validate-dto.js';
import { UpdateXPConfigDto } from '#root/lib/dtos/xp/update-xp-config.dto.js';
import type { UpdateXPConfigDTO } from '#root/modules/xp/xp-text/dtos/update-xp-config.dto.js';

function normalizeLevelCurveType(
  levelCurveType: unknown
): UpdateXPConfigDTO['levelCurveType'] | undefined {
  if (levelCurveType === undefined) return undefined;
  if (levelCurveType === 'TABLE') return 'TABLE' as UpdateXPConfigDTO['levelCurveType'];
  return 'FORMULA' as UpdateXPConfigDTO['levelCurveType'];
}

export class XPConfigRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/xp/config',
      methods: ['GET', 'PUT'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;

    if (!guildId) {
      return response.status(400).json({
        error: 'Guild ID is required',
      });
    }

    // Verify guild exists
    const guild = this.container.client.guilds.cache.get(guildId);
    if (!guild) {
      return response.status(404).json({
        error: 'Guild not found or bot is not in the guild',
      });
    }

    if (request.method === 'GET') {
      return this.handleGet(guildId, response);
    } else if (request.method === 'PUT') {
      // Parse body for PUT requests
      const body = await parseRequestBody(request);
      return this.handlePut(guildId, body, response);
    }

    return response.status(405).json({ error: 'Method not allowed' });
  }

  /**
   * GET - Retrieve XP configuration
   */
  private async handleGet(guildId: string, response: Route.Response) {
    try {
      const config = await configService.getConfig(guildId);

      return response.json({
        success: true,
        config,
      });
    } catch (error) {
      this.container.logger.error('Error fetching XP config:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }

  /**
   * PUT - Update XP configuration
   */
  private async handlePut(guildId: string, updateData: unknown, response: Route.Response) {
    try {
      if (!updateData) {
        return response.status(400).json({
          error: 'Request body is required',
        });
      }

      // Debug log
      this.container.logger.debug('XP Config Update Request:', JSON.stringify(updateData, null, 2));

      // Validate update data
      const validation = await validateDto(UpdateXPConfigDto, updateData);
      if (!validation.success) {
        return response.status(400).json({
          error: 'Validation failed',
          details: validation.errors,
        });
      }
      if (!validation.data) {
        return response.status(400).json({
          error: 'Validation returned no data',
        });
      }

      const normalizedData: UpdateXPConfigDTO = {
        ...(validation.data as UpdateXPConfigDTO),
        ...(validation.data.levelCurveType !== undefined
          ? { levelCurveType: normalizeLevelCurveType(validation.data.levelCurveType) }
          : {}),
      };

      // Update configuration (cast to service's expected interface)
      const config = await configService.updateConfig(guildId, normalizedData);

      return response.json({
        success: true,
        config,
      });
    } catch (error) {
      this.container.logger.error('Error updating XP config:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
