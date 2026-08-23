import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockCreate, mockFindMany, mockCount } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
}));

vi.mock('#config.js', () => ({
  CONFIG: {
    EVIDENCE_HMAC_SECRET: 'test-hmac-secret',
  },
}));

vi.mock('@sapphire/framework', async () => {
  const actual = await vi.importActual('@sapphire/framework');
  return {
    ...actual,
    container: {
      prisma: {
        evidenceAccessLog: {
          create: mockCreate,
          findMany: mockFindMany,
          count: mockCount,
        },
      },
      logger: {
        debug: vi.fn(),
        error: vi.fn(),
      },
    },
  };
});

import { accessLogService } from '#modules/moderation/services/AccessLogService.js';
import { createHmac } from 'node:crypto';

describe('AccessLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logAccess', () => {
    it('logs a VIEW action with correct data', async () => {
      const mockLog = {
        id: 'log-1',
        evidenceId: 'ev-1',
        guildId: 'guild-1',
        userId: 'user-1',
        userTag: 'TestUser#1234',
        action: 'VIEW',
        ipHash: null,
        userAgent: null,
        metadata: {},
        createdAt: new Date(),
      };
      mockCreate.mockResolvedValue(mockLog);

      const result = await accessLogService.logAccess(
        'ev-1',
        'guild-1',
        'user-1',
        'TestUser#1234',
        'VIEW'
      );

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          evidenceId: 'ev-1',
          guildId: 'guild-1',
          userId: 'user-1',
          userTag: 'TestUser#1234',
          action: 'VIEW',
          ipHash: null,
          userAgent: null,
          metadata: {},
        },
      });
      expect(result.id).toBe('log-1');
    });

    it('logs a DOWNLOAD action', async () => {
      mockCreate.mockResolvedValue({ id: 'log-2', action: 'DOWNLOAD' });

      await accessLogService.logAccess('ev-1', 'guild-1', 'user-1', 'User#1', 'DOWNLOAD');

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'DOWNLOAD' }),
      });
    });

    it('logs an EXPORT action', async () => {
      mockCreate.mockResolvedValue({ id: 'log-3', action: 'EXPORT' });

      await accessLogService.logAccess('ev-1', 'guild-1', 'user-1', 'User#1', 'EXPORT');

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'EXPORT' }),
      });
    });

    it('hashes IP address with HMAC-SHA256 from request', async () => {
      mockCreate.mockImplementation((args: any) => Promise.resolve({ id: 'log-4', ...args.data }));

      const request = {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'TestBrowser/1.0',
        },
        socket: { remoteAddress: '127.0.0.1' },
      } as any;

      await accessLogService.logAccess('ev-1', 'guild-1', 'user-1', 'User#1', 'VIEW', request);

      const expectedHash = createHmac('sha256', 'test-hmac-secret')
        .update('192.168.1.100')
        .digest('hex');

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipHash: expectedHash,
          userAgent: 'TestBrowser/1.0',
        }),
      });
    });

    it('IP hashing is one-way (same IP always produces same hash)', async () => {
      mockCreate.mockImplementation((args: any) => Promise.resolve({ id: 'log-5', ...args.data }));

      const request1 = { headers: { 'x-forwarded-for': '10.0.0.1' }, socket: {} } as any;
      const request2 = { headers: { 'x-forwarded-for': '10.0.0.1' }, socket: {} } as any;

      await accessLogService.logAccess('ev-1', 'guild-1', 'user-1', 'User#1', 'VIEW', request1);
      await accessLogService.logAccess('ev-2', 'guild-1', 'user-2', 'User#2', 'VIEW', request2);

      const hash1 = mockCreate.mock.calls[0]![0].data.ipHash;
      const hash2 = mockCreate.mock.calls[1]![0].data.ipHash;

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe('10.0.0.1'); // Not reversible to original IP
    });

    it('uses socket remoteAddress as fallback when no x-forwarded-for', async () => {
      mockCreate.mockImplementation((args: any) => Promise.resolve({ id: 'log-6', ...args.data }));

      const request = {
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as any;

      await accessLogService.logAccess('ev-1', 'guild-1', 'user-1', 'User#1', 'VIEW', request);

      const expectedHash = createHmac('sha256', 'test-hmac-secret')
        .update('127.0.0.1')
        .digest('hex');

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ ipHash: expectedHash }),
      });
    });

    it('captures user-agent from request', async () => {
      mockCreate.mockImplementation((args: any) => Promise.resolve({ id: 'log-7', ...args.data }));

      const request = {
        headers: { 'user-agent': 'Mozilla/5.0 (Test)' },
        socket: {},
      } as any;

      await accessLogService.logAccess('ev-1', 'guild-1', 'user-1', 'User#1', 'VIEW', request);

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ userAgent: 'Mozilla/5.0 (Test)' }),
      });
    });

    it('handles request with no IP gracefully', async () => {
      mockCreate.mockImplementation((args: any) => Promise.resolve({ id: 'log-8', ...args.data }));

      const request = {
        headers: {},
        socket: {},
      } as any;

      await accessLogService.logAccess('ev-1', 'guild-1', 'user-1', 'User#1', 'VIEW', request);

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ ipHash: null }),
      });
    });

    it('stores custom metadata', async () => {
      mockCreate.mockImplementation((args: any) => Promise.resolve({ id: 'log-9', ...args.data }));

      await accessLogService.logAccess(
        'ev-1',
        'guild-1',
        'user-1',
        'User#1',
        'EXPORT',
        undefined,
        { exportFormat: 'pdf', caseNumber: 42 }
      );

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: { exportFormat: 'pdf', caseNumber: 42 },
        }),
      });
    });
  });

  describe('getAccessLog', () => {
    it('returns paginated access logs for evidence', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          evidenceId: 'ev-1',
          guildId: 'guild-1',
          userId: 'user-1',
          userTag: 'User#1',
          action: 'VIEW',
          ipHash: 'hash1',
          userAgent: 'Browser/1.0',
          metadata: {},
          createdAt: new Date(),
        },
      ];
      mockFindMany.mockResolvedValue(mockLogs);
      mockCount.mockResolvedValue(25);

      const result = await accessLogService.getAccessLog('ev-1', { page: 1, limit: 10 });

      expect(result.logs).toHaveLength(1);
      expect(result.total).toBe(25);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(3);
    });

    it('uses default pagination (page 1, limit 50)', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await accessLogService.getAccessLog('ev-1');

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 50,
        })
      );
    });

    it('clamps limit to max 100', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await accessLogService.getAccessLog('ev-1', { limit: 500 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });

    it('clamps page to minimum 1', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await accessLogService.getAccessLog('ev-1', { page: -5 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 })
      );
    });

    it('returns totalPages of 1 when no logs exist', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const result = await accessLogService.getAccessLog('ev-1');

      expect(result.totalPages).toBe(1);
    });
  });

  describe('getGuildAccessLog', () => {
    it('filters by guild ID', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await accessLogService.getGuildAccessLog('guild-1');

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { guildId: 'guild-1' },
        })
      );
    });

    it('applies optional filters (evidenceId, userId, action)', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await accessLogService.getGuildAccessLog('guild-1', {
        evidenceId: 'ev-1',
        userId: 'user-1',
        action: 'DOWNLOAD',
      });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            guildId: 'guild-1',
            evidenceId: 'ev-1',
            userId: 'user-1',
            action: 'DOWNLOAD',
          },
        })
      );
    });

    it('logs are scoped to guild (cannot see other guild logs)', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await accessLogService.getGuildAccessLog('guild-A');

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ guildId: 'guild-A' }),
        })
      );
    });
  });
});
