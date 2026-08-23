import { Route } from '@sapphire/plugin-api';
import { CaseStatus, type Prisma } from '@prisma/client';
import { ApiGate } from '#lib/validation/ApiGate.js';
import { parseModAction } from '#lib/validation/modAction.js';

export class ModerationCasesRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/moderation/cases',
      methods: ['GET'],
    });
  }

  public async run(request: Route.Request, response: Route.Response) {
    const { guildId } = request.params;

    if (!guildId) {
      return response.status(400).json({
        error: 'Guild ID is required',
      });
    }

    const gate = await ApiGate.fromRequest(request, guildId);
    if (!gate) {
      return response.status(401).json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' });
    }

    const auth = await gate.checkAuth('mod.case');
    if (!auth.ok) {
      return response.status(403).json({ error: 'Forbidden', code: auth.code });
    }

    return this.handleGet(guildId, request, response);
  }

  private async handleGet(guildId: string, request: Route.Request, response: Route.Response) {
    try {
      // Parse query parameters for pagination and filtering
      const page = parseInt((request.query?.page as string) ?? '1') || 1;
      const limit = Math.min(parseInt((request.query?.limit as string) ?? '50') || 50, 100);
      const actionStr = request.query?.action as string | undefined;
      const targetId = request.query?.targetId as string | undefined;
      const moderatorId = request.query?.moderatorId as string | undefined;
      const statusStr = request.query?.status as string | undefined;
      const sort = (request.query?.sort as string) ?? 'createdAt';
      const order = (request.query?.order as string) ?? 'desc';
      const search = request.query?.search as string | undefined;

      const skip = (page - 1) * limit;

      // Validate and convert action string to enum
      const action = actionStr ? parseModAction(actionStr.toUpperCase()) : undefined;

      // Validate status
      const status =
        statusStr && statusStr.toUpperCase() in CaseStatus
          ? (statusStr.toUpperCase() as CaseStatus)
          : undefined;

      // Validate sort field
      const allowedSortFields = ['createdAt', 'caseNumber', 'updatedAt'];
      const sortField = allowedSortFields.includes(sort) ? sort : 'createdAt';
      const sortOrder = order === 'asc' ? ('asc' as const) : ('desc' as const);

      // Build where clause with proper typing
      const where: Prisma.ModCaseWhereInput = { guildId };

      if (action) where.action = action;
      if (targetId) where.targetId = targetId;
      if (moderatorId) where.moderatorId = moderatorId;
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { targetTag: { contains: search, mode: 'insensitive' } },
          { targetId: { contains: search } },
          { moderatorTag: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Get total count and cases in parallel
      const [total, cases] = await Promise.all([
        this.container.prisma.modCase.count({ where }),
        this.container.prisma.modCase.findMany({
          where,
          orderBy: { [sortField]: sortOrder },
          skip,
          take: limit,
        }),
      ]);

      return response.json({
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        cases,
      });
    } catch (error) {
      this.container.logger.error('Error fetching moderation cases:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
