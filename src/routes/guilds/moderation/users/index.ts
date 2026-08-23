import { Route } from '@sapphire/plugin-api';
import { Prisma } from '@prisma/client';

interface ModeratedUser {
  userId: string;
  targetTag: string;
  totalCases: number;
  activeFlagsCount: number;
  notesCount: number;
  firstCaseDate: string | null;
  lastCaseDate: string | null;
  caseBreakdown: Record<string, number>;
  // Server status - cache-only for list view (fast, no API calls)
  // 'in_server' = confirmed in cache, 'unknown' = not in cache (could be in server or left)
  serverStatus: 'in_server' | 'unknown';
  // Avatar URL from Discord user/member cache (no API calls)
  avatarUrl: string | null;
}

export class ModerationUsersRoute extends Route {
  public constructor(context: Route.LoaderContext, options: Route.Options) {
    super(context, {
      ...options,
      route: 'guilds/[guildId]/moderation/users',
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

    // Verify guild exists in cache
    const discordGuild = this.container.client.guilds.cache.get(guildId);
    if (!discordGuild) {
      return response.status(404).json({
        error: 'Guild not found or bot is not in the guild',
      });
    }

    return this.handleGet(guildId, request, response);
  }

  private async handleGet(guildId: string, request: Route.Request, response: Route.Response) {
    try {
      const page = Math.max(1, parseInt((request.query?.page as string) ?? '1', 10) || 1);
      const limit = Math.min(
        Math.max(1, parseInt((request.query?.limit as string) ?? '25', 10) || 25),
        100
      );
      const search = request.query?.search as string | undefined;
      const sort = (request.query?.sort as string) ?? 'totalCases';

      // Build search condition
      const searchCondition = search
        ? Prisma.sql`AND ("targetTag" ILIKE ${'%' + search + '%'} OR "targetId" LIKE ${'%' + search + '%'})`
        : Prisma.empty;

      // Get users with moderation cases using raw SQL for aggregation
      const orderBy = sort === 'lastCaseDate' ? 'last_case_date' : 'total_cases';
      const usersWithCases = await this.container.prisma.$queryRaw<
        Array<{
          target_id: string;
          target_tag: string;
          total_cases: bigint;
          first_case_date: Date | null;
          last_case_date: Date | null;
        }>
      >`
        SELECT
          "targetId" as target_id,
          MAX("targetTag") as target_tag,
          COUNT(*) as total_cases,
          MIN("createdAt") as first_case_date,
          MAX("createdAt") as last_case_date
        FROM "mod_cases"
        WHERE "guildId" = ${guildId} ${searchCondition}
        GROUP BY "targetId"
        ORDER BY ${Prisma.raw(orderBy)} DESC
        LIMIT ${limit}
        OFFSET ${(page - 1) * limit}
      `;

      // Get total count of unique users
      const totalResult = await this.container.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT "targetId") as count
        FROM "mod_cases"
        WHERE "guildId" = ${guildId} ${searchCondition}
      `;
      const total = Number(totalResult[0]?.count ?? 0);

      // Get active flags count for these users
      const userIds = usersWithCases.map((u) => u.target_id);
      const flagCounts =
        userIds.length > 0
          ? await this.container.prisma.userFlag.groupBy({
              by: ['userId'],
              where: {
                guildId,
                userId: { in: userIds },
                active: true,
              },
              _count: { userId: true },
            })
          : [];

      const flagCountMap = new Map(flagCounts.map((f) => [f.userId, f._count.userId]));

      // Get case breakdown for each user
      const caseBreakdowns =
        userIds.length > 0
          ? await this.container.prisma.modCase.groupBy({
              by: ['targetId', 'action'],
              where: {
                guildId,
                targetId: { in: userIds },
              },
              _count: { action: true },
            })
          : [];

      const breakdownMap = new Map<string, Record<string, number>>();
      for (const item of caseBreakdowns) {
        if (!breakdownMap.has(item.targetId)) {
          breakdownMap.set(item.targetId, {});
        }
        breakdownMap.get(item.targetId)![item.action] = item._count.action;
      }

      // Get notes count for each user
      const notesCounts =
        userIds.length > 0
          ? await this.container.prisma.userModNote.groupBy({
              by: ['userId'],
              where: {
                guildId,
                userId: { in: userIds },
              },
              _count: { userId: true },
            })
          : [];
      const notesCountMap = new Map(notesCounts.map((n) => [n.userId, n._count.userId]));

      // Check membership and avatars via cache only (no API calls for list view performance)
      const discordGuild = this.container.client.guilds.cache.get(guildId)!;

      const users: ModeratedUser[] = usersWithCases.map((u) => {
        const member = discordGuild.members.cache.get(u.target_id);
        const user = this.container.client.users.cache.get(u.target_id);
        // Prefer guild-specific member avatar, then global user avatar
        const avatarUrl =
          member?.displayAvatarURL({ size: 64 }) ?? user?.displayAvatarURL({ size: 64 }) ?? null;

        return {
          userId: u.target_id,
          targetTag: u.target_tag,
          totalCases: Number(u.total_cases),
          activeFlagsCount: flagCountMap.get(u.target_id) ?? 0,
          notesCount: notesCountMap.get(u.target_id) ?? 0,
          firstCaseDate: u.first_case_date?.toISOString() ?? null,
          lastCaseDate: u.last_case_date?.toISOString() ?? null,
          caseBreakdown: breakdownMap.get(u.target_id) ?? {},
          serverStatus: member ? 'in_server' : 'unknown',
          avatarUrl,
        };
      });

      // Get overall stats
      const stats = await this.container.prisma.modCase.aggregate({
        where: { guildId },
        _count: { id: true },
      });

      const uniqueUsersTotal = await this.container.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT "targetId") as count FROM "mod_cases" WHERE "guildId" = ${guildId}
      `;

      const activeFlagsTotal = await this.container.prisma.userFlag.count({
        where: { guildId, active: true },
      });

      return response.json({
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats: {
          totalCases: stats._count.id,
          uniqueUsers: Number(uniqueUsersTotal[0]?.count ?? 0),
          activeFlags: activeFlagsTotal,
        },
      });
    } catch (error) {
      this.container.logger.error('Error fetching moderated users:', error);
      return response.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
