import { Route } from '@sapphire/plugin-api';
import { URL } from 'url';
import { listPermissionGrants, createPermissionGrant } from '#lib/validation/permissionResolver.js';
import { validateDto } from '#lib/validation/validate-dto.js';
import { CreatePermissionGrantDto } from '#lib/dtos/permissions/permission-grant.dto.js';
import type { PermissionSubjectType, PermissionResourceType } from '@prisma/client';

export class PermissionGrantsRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/permissions/grants',
      methods: ['GET', 'POST'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;

    if (!guildId) {
      return response.status(400).json({ error: 'Guild ID is required' });
    }

    const discordGuild = this.container.client.guilds.cache.get(guildId);
    if (!discordGuild) {
      return response.status(404).json({ error: 'Guild not found or bot is not in the guild' });
    }

    if (request.method === 'GET') {
      return this.handleGet(guildId, request, response);
    } else if (request.method === 'POST') {
      return this.handlePost(guildId, request, response);
    }

    return response.status(405).json({ error: 'Method not allowed' });
  }

  private async handleGet(guildId: string, request: Route.Request, response: Route.Response) {
    try {
      const requestUrl = request.url ?? '';
      const url = new URL(requestUrl, 'http://localhost');
      const subjectType = url.searchParams.get('subjectType') as PermissionSubjectType | null;
      const subjectId = url.searchParams.get('subjectId');
      const resourceType = url.searchParams.get('resourceType') as PermissionResourceType | null;
      const resourceKey = url.searchParams.get('resourceKey');

      const filters: {
        subjectType?: PermissionSubjectType;
        subjectId?: string;
        resourceType?: PermissionResourceType;
        resourceKey?: string;
      } = {};

      if (subjectType) filters.subjectType = subjectType;
      if (subjectId) filters.subjectId = subjectId;
      if (resourceType) filters.resourceType = resourceType;
      if (resourceKey) filters.resourceKey = resourceKey;

      const grants = await listPermissionGrants(guildId, filters);

      return response.json({
        total: grants.length,
        grants: grants.map((g) => ({
          id: g.id,
          guildId: g.guildId,
          subjectType: g.subjectType,
          subjectId: g.subjectId,
          resourceType: g.resourceType,
          resourceKey: g.resourceKey,
          effect: g.effect,
          createdById: g.createdById,
          createdAt: g.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      this.container.logger.error('Error fetching permission grants:', error);
      return response.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handlePost(guildId: string, request: Route.Request, response: Route.Response) {
    try {
      const body = (request as Route.Request & { body?: unknown }).body;

      // Validate request body
      const validation = await validateDto(CreatePermissionGrantDto, body);
      if (!validation.success) {
        return response.status(400).json({
          error: 'Validation failed',
          details: validation.errors,
        });
      }

      if (!validation.data) {
        return response.status(400).json({ error: 'Invalid request data' });
      }

      const { subjectType, subjectId, resourceType, resourceKey, effect, createdById } =
        validation.data;

      const grant = await createPermissionGrant(
        guildId,
        subjectType,
        subjectId,
        resourceType,
        resourceKey,
        effect,
        createdById
      );

      return response.status(201).json({
        id: grant.id,
        guildId: grant.guildId,
        subjectType: grant.subjectType,
        subjectId: grant.subjectId,
        resourceType: grant.resourceType,
        resourceKey: grant.resourceKey,
        effect: grant.effect,
        createdById: grant.createdById,
        createdAt: grant.createdAt.toISOString(),
      });
    } catch (error) {
      this.container.logger.error('Error creating permission grant:', error);
      return response.status(500).json({ error: 'Internal server error' });
    }
  }
}
