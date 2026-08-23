import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModerationUsersRoute } from '#routes/guilds/moderation/users/index.js';
import {
  createMockRequest,
  createMockResponse,
  createMockContainer,
  expectStatus,
  expectSuccess,
} from '../../../helpers/test-helpers.js';

describe('ModerationUsersRoute', () => {
  let route: ModerationUsersRoute;
  let mockContainer: ReturnType<typeof createMockContainer>;
  const mockQueryRaw = vi.fn();
  const mockUserFlagGroupBy = vi.fn();
  const mockModCaseGroupBy = vi.fn();
  const mockUserModNoteGroupBy = vi.fn();
  const mockModCaseAggregate = vi.fn();
  const mockUserFlagCount = vi.fn();

  beforeEach(() => {
    const mockMember = {
      displayAvatarURL: vi.fn().mockReturnValue('https://cdn.discord.com/member-avatar.png'),
    };
    const mockUser = {
      displayAvatarURL: vi.fn().mockReturnValue('https://cdn.discord.com/user-avatar.png'),
    };
    const membersCache = new Map([['user-1', mockMember]]);
    const usersCache = new Map([['user-2', mockUser]]);
    const mockGuild = {
      id: '123456789',
      members: { cache: membersCache },
    };
    const guildsCache = new Map([['123456789', mockGuild]]);

    mockContainer = createMockContainer({
      client: { guilds: { cache: guildsCache }, users: { cache: usersCache } } as any,
    });
    (mockContainer as any).prisma = {
      $queryRaw: mockQueryRaw,
      userFlag: { groupBy: mockUserFlagGroupBy, count: mockUserFlagCount },
      modCase: { groupBy: mockModCaseGroupBy, aggregate: mockModCaseAggregate },
      userModNote: { groupBy: mockUserModNoteGroupBy },
    };

    route = Object.create(ModerationUsersRoute.prototype);
    Object.defineProperty(route, 'container', {
      get: () => mockContainer,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  /** Helper to set up standard mocks for a successful response with users */
  function setupUsersResponse(
    users: Array<{
      target_id: string;
      target_tag: string;
      total_cases: bigint;
      first_case_date: Date | null;
      last_case_date: Date | null;
    }>,
    total: number,
  ) {
    // First $queryRaw call: users with cases
    mockQueryRaw.mockResolvedValueOnce(users);
    // Second $queryRaw call: total count
    mockQueryRaw.mockResolvedValueOnce([{ count: BigInt(total) }]);
    // Third $queryRaw call: uniqueUsersTotal in stats
    mockQueryRaw.mockResolvedValueOnce([{ count: BigInt(total) }]);

    mockUserFlagGroupBy.mockResolvedValue([]);
    mockModCaseGroupBy.mockResolvedValue([]);
    mockUserModNoteGroupBy.mockResolvedValue([]);
    mockModCaseAggregate.mockResolvedValue({ _count: { id: total } });
    mockUserFlagCount.mockResolvedValue(0);
  }

  /** Helper to set up empty response mocks */
  function setupEmptyResponse() {
    mockQueryRaw.mockResolvedValueOnce([]);
    mockQueryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);
    mockQueryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);

    mockUserFlagGroupBy.mockResolvedValue([]);
    mockModCaseGroupBy.mockResolvedValue([]);
    mockUserModNoteGroupBy.mockResolvedValue([]);
    mockModCaseAggregate.mockResolvedValue({ _count: { id: 0 } });
    mockUserFlagCount.mockResolvedValue(0);
  }

  describe('GET /guilds/:guildId/moderation/users', () => {
    it('returns paginated moderated users with correct response shape', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 86400000);
      setupUsersResponse(
        [
          {
            target_id: 'user-1',
            target_tag: 'TestUser#0001',
            total_cases: BigInt(5),
            first_case_date: earlier,
            last_case_date: now,
          },
          {
            target_id: 'user-2',
            target_tag: 'AnotherUser#0002',
            total_cases: BigInt(3),
            first_case_date: earlier,
            last_case_date: now,
          },
        ],
        2,
      );

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { page: '1', limit: '25' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.users).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(25);
      expect(data.totalPages).toBe(1);
      expect(data.stats).toEqual(
        expect.objectContaining({
          totalCases: expect.any(Number),
          uniqueUsers: expect.any(Number),
          activeFlags: expect.any(Number),
        }),
      );
      // Verify user shape
      expect(data.users[0]).toEqual(
        expect.objectContaining({
          userId: 'user-1',
          targetTag: 'TestUser#0001',
          totalCases: 5,
          activeFlagsCount: expect.any(Number),
          notesCount: expect.any(Number),
          firstCaseDate: expect.any(String),
          lastCaseDate: expect.any(String),
          caseBreakdown: expect.any(Object),
          serverStatus: expect.stringMatching(/^(in_server|unknown)$/),
          avatarUrl: expect.any(String),
        }),
      );
    });

    it('handles empty results', async () => {
      setupEmptyResponse();

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.users).toHaveLength(0);
      expect(data.total).toBe(0);
      expect(data.totalPages).toBe(0);
    });

    it('respects page and limit params', async () => {
      setupEmptyResponse();

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { page: '3', limit: '10' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.page).toBe(3);
      expect(data.limit).toBe(10);
    });

    it('caps limit at 100', async () => {
      setupEmptyResponse();

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { limit: '500' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.limit).toBe(100);
    });

    it('minimum page is 1', async () => {
      setupEmptyResponse();

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { page: '-1' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.page).toBe(1);
    });

    it('search filtering triggers ILIKE condition', async () => {
      setupEmptyResponse();

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { search: 'TestUser' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      // Verify $queryRaw was called (the search condition is embedded in the tagged template)
      expect(mockQueryRaw).toHaveBeenCalled();
    });

    it('sort by lastCaseDate is accepted', async () => {
      setupEmptyResponse();

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
        query: { sort: 'lastCaseDate' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      expect(mockQueryRaw).toHaveBeenCalled();
    });

    it('avatar from member cache (member present in guild)', async () => {
      const now = new Date();
      setupUsersResponse(
        [
          {
            target_id: 'user-1',
            target_tag: 'MemberUser#0001',
            total_cases: BigInt(1),
            first_case_date: now,
            last_case_date: now,
          },
        ],
        1,
      );

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.users[0].avatarUrl).toBe('https://cdn.discord.com/member-avatar.png');
      expect(data.users[0].serverStatus).toBe('in_server');
    });

    it('avatar from user cache (not a member but user is cached)', async () => {
      const now = new Date();
      setupUsersResponse(
        [
          {
            target_id: 'user-2',
            target_tag: 'CachedUser#0002',
            total_cases: BigInt(2),
            first_case_date: now,
            last_case_date: now,
          },
        ],
        1,
      );

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.users[0].avatarUrl).toBe('https://cdn.discord.com/user-avatar.png');
      expect(data.users[0].serverStatus).toBe('unknown');
    });

    it('no avatar when user is not in any cache', async () => {
      const now = new Date();
      setupUsersResponse(
        [
          {
            target_id: 'user-unknown',
            target_tag: 'UnknownUser#9999',
            total_cases: BigInt(1),
            first_case_date: now,
            last_case_date: now,
          },
        ],
        1,
      );

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      const data = response.data as any;
      expect(data.users[0].avatarUrl).toBeNull();
      expect(data.users[0].serverStatus).toBe('unknown');
    });

    it('returns 400 for missing guildId', async () => {
      const request = createMockRequest({
        method: 'GET',
        params: {},
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 400);
      const data = response.data as any;
      expect(data.error).toBe('Guild ID is required');
    });

    it('returns 404 for guild not in cache', async () => {
      const request = createMockRequest({
        method: 'GET',
        params: { guildId: 'nonexistent-guild' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 404);
      const data = response.data as any;
      expect(data.error).toBe('Guild not found or bot is not in the guild');
    });

    it('returns 500 on internal error', async () => {
      mockQueryRaw.mockRejectedValueOnce(new Error('Database connection lost'));

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectStatus(response, 500);
      const data = response.data as any;
      expect(data.error).toBe('Internal server error');
    });

    it('skips groupBy queries when no users found', async () => {
      setupEmptyResponse();

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      // When userIds is empty, groupBy should not be called
      expect(mockUserFlagGroupBy).not.toHaveBeenCalled();
      expect(mockModCaseGroupBy).not.toHaveBeenCalled();
      expect(mockUserModNoteGroupBy).not.toHaveBeenCalled();
    });

    it('guild isolation: queries scoped to guildId', async () => {
      setupEmptyResponse();

      const request = createMockRequest({
        method: 'GET',
        params: { guildId: '123456789' },
      });
      const response = createMockResponse();

      await route.run(request, response as any);

      expectSuccess(response);
      // The modCase.aggregate stats call should be scoped to guildId
      expect(mockModCaseAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { guildId: '123456789' },
        }),
      );
      // The userFlag.count stats call should be scoped to guildId
      expect(mockUserFlagCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ guildId: '123456789' }),
        }),
      );
    });
  });
});
