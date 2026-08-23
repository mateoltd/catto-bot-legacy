/**
 * Unit tests for Moderation Logs and Test Routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse, createMockContainer, expectSuccess, expectError } from '../../../helpers/test-helpers.js';
import { TempVoiceModerationLogsGetRoute } from '../../../../src/routes/guilds/temp-voice/moderation/logs-get.js';
import { TempVoiceModerationTestPostRoute } from '../../../../src/routes/guilds/temp-voice/moderation/test-post.js';
import { NameValidationService } from '../../../../src/modules/temp-voice/services/moderation/name-validation.service.js';

const { mockApiGateFromRequest } = vi.hoisted(() => ({
    mockApiGateFromRequest: vi.fn(),
}));

vi.mock('#lib/validation/ApiGate.js', () => ({
    ApiGate: { fromRequest: mockApiGateFromRequest },
}));

function createMockGate(overrides: Partial<{ authOk: boolean }> = {}) {
    return {
        userId: 'user-123',
        isAdmin: false,
        checkAuth: vi.fn().mockResolvedValue({
            ok: overrides.authOk ?? true,
            code: overrides.authOk === false ? 'NO_PERMISSION' : undefined,
        }),
    };
}

// Create shared mock functions
const mockValidate = vi.fn();

// Mock NameValidationService
vi.mock('#modules/temp-voice/services/moderation/name-validation.service.js', () => ({
    NameValidationService: class {
        validate = mockValidate;
    },
}));

describe('Moderation Logs and Test Routes', () => {
    let mockContainer: ReturnType<typeof createMockContainer>;
    let mockPrisma: any;

    beforeEach(() => {
        mockPrisma = {
            tempVoiceModerationLog: {
                findMany: vi.fn(),
                count: vi.fn(),
            },
            tempVoiceConfig: {
                findUnique: vi.fn(),
            },
        };

        mockContainer = createMockContainer();
        mockContainer.prisma = mockPrisma;
        mockApiGateFromRequest.mockResolvedValue(createMockGate());

        vi.clearAllMocks();
        mockApiGateFromRequest.mockResolvedValue(createMockGate());
    });

    describe('GET /guilds/:guildId/temp-voice/moderation/logs', () => {
        let route: TempVoiceModerationLogsGetRoute;

        beforeEach(() => {
            route = Object.create(TempVoiceModerationLogsGetRoute.prototype);
            Object.defineProperty(route, 'container', {
                get: () => mockContainer,
                configurable: true,
            });
        });

        it('should return moderation logs', async () => {
            const mockLogs = [
                {
                    id: 'log-1',
                    guildId: 'guild-123',
                    channelId: 'channel-1',
                    userId: 'user-1',
                    actionTaken: 'AUTO_RENAMED',
                    originalName: 'BadName',
                    finalName: 'Safe Room',
                    reasonCodes: ['PROFANITY'],
                    matchedPatterns: ['bad.*word'],
                    heuristicScore: 0.85,
                    createdAt: new Date(),
                },
            ];

            mockPrisma.tempVoiceModerationLog.findMany.mockResolvedValue(mockLogs);
            mockPrisma.tempVoiceModerationLog.count.mockResolvedValue(1);

            const request = createMockRequest({
                method: 'GET',
                params: { guildId: 'guild-123' },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            const data = response.data as any;
            expect(data.success).toBe(true);
            expect(data.data.logs).toHaveLength(1);
            expect(data.data.logs[0].actionTaken).toBe('AUTO_RENAMED');
            expect(data.data.pagination.total).toBe(1);
        });

        it('should filter by action', async () => {
            mockPrisma.tempVoiceModerationLog.findMany.mockResolvedValue([]);
            mockPrisma.tempVoiceModerationLog.count.mockResolvedValue(0);

            const request = createMockRequest({
                method: 'GET',
                params: { guildId: 'guild-123' },
                url: 'http://localhost/test?action=BLOCKED',
            });
            request.query = { action: 'BLOCKED' };

            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            expect(mockPrisma.tempVoiceModerationLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ actionTaken: 'BLOCKED' }),
                })
            );
        });

        it('should filter by channelId', async () => {
            mockPrisma.tempVoiceModerationLog.findMany.mockResolvedValue([]);
            mockPrisma.tempVoiceModerationLog.count.mockResolvedValue(0);

            const request = createMockRequest({
                method: 'GET',
                params: { guildId: 'guild-123' },
                url: 'http://localhost/test?channelId=channel-1',
            });
            request.query = { channelId: 'channel-1' };

            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            expect(mockPrisma.tempVoiceModerationLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ channelId: 'channel-1' }),
                })
            );
        });

        it('should apply pagination', async () => {
            mockPrisma.tempVoiceModerationLog.findMany.mockResolvedValue([]);
            mockPrisma.tempVoiceModerationLog.count.mockResolvedValue(100);

            const request = createMockRequest({
                method: 'GET',
                params: { guildId: 'guild-123' },
                url: 'http://localhost/test?limit=10&offset=20',
            });
            request.query = { limit: '10', offset: '20' };

            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            const data = response.data as any;
            expect(data.data.pagination.hasMore).toBe(true);
            expect(mockPrisma.tempVoiceModerationLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 10,
                    skip: 20,
                })
            );
        });

        it('should return error for missing guildId', async () => {
            const request = createMockRequest({
                method: 'GET',
                params: {},
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectError(response, 400);
            const data = response.data as any;
            expect(data.error.code).toBe('MISSING_GUILD_ID');
        });
    });

    describe('POST /guilds/:guildId/temp-voice/moderation/test', () => {
        let route: TempVoiceModerationTestPostRoute;

        beforeEach(() => {
            route = Object.create(TempVoiceModerationTestPostRoute.prototype);
            Object.defineProperty(route, 'container', {
                get: () => mockContainer,
                configurable: true,
            });
        });

        it('should validate a clean name', async () => {
            const mockConfig = {
                guildId: 'guild-123',
                strictMode: false,
                customPatterns: JSON.stringify([]),
            };

            mockPrisma.tempVoiceConfig.findUnique.mockResolvedValue(mockConfig);

            const mockValidationResult = {
                isAllowed: true,
                reasonCodes: [],
                matchedPatterns: [],
            };

            mockValidate.mockResolvedValue(mockValidationResult as any);

            const request = createMockRequest({
                method: 'POST',
                params: { guildId: 'guild-123' },
                body: {
                    name: 'Clean Room Name',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            const data = response.data as any;
            expect(data.success).toBe(true);
            expect(data.data.isAllowed).toBe(true);
            expect(data.data.testName).toBe('Clean Room Name');
        });

        it('should validate a problematic name', async () => {
            mockPrisma.tempVoiceConfig.findUnique.mockResolvedValue({
                guildId: 'guild-123',
                strictMode: false,
                customPatterns: JSON.stringify([]),
            });

            const mockValidationResult = {
                isAllowed: false,
                reasonCodes: ['PROFANITY'],
                matchedPatterns: ['bad.*word'],
            };

            mockValidate.mockResolvedValue(mockValidationResult as any);

            const request = createMockRequest({
                method: 'POST',
                params: { guildId: 'guild-123' },
                body: {
                    name: 'BadWord Room',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            const data = response.data as any;
            expect(data.success).toBe(true);
            expect(data.data.isAllowed).toBe(false);
            expect(data.data.reasonCodes).toContain('PROFANITY');
        });

        it('should apply strict mode from request', async () => {
            mockPrisma.tempVoiceConfig.findUnique.mockResolvedValue({
                guildId: 'guild-123',
                strictMode: false,
                customPatterns: JSON.stringify([]),
            });

            const mockService = new NameValidationService();
            vi.mocked(mockService.validate).mockResolvedValue({
                isAllowed: true,
                reasonCodes: [],
                matchedPatterns: [],
            } as any);

            const request = createMockRequest({
                method: 'POST',
                params: { guildId: 'guild-123' },
                body: {
                    name: 'Test Room',
                    strictMode: true,
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            expect(mockValidate).toHaveBeenCalledWith(
                'Test Room',
                expect.objectContaining({ strictMode: true })
            );
        });

        it('should use guild strict mode config', async () => {
            mockPrisma.tempVoiceConfig.findUnique.mockResolvedValue({
                guildId: 'guild-123',
                strictMode: true,
                customPatterns: JSON.stringify([]),
            });

            const mockService = new NameValidationService();
            vi.mocked(mockService.validate).mockResolvedValue({
                isAllowed: true,
                reasonCodes: [],
                matchedPatterns: [],
            } as any);

            const request = createMockRequest({
                method: 'POST',
                params: { guildId: 'guild-123' },
                body: {
                    name: 'Test Room',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            expect(mockValidate).toHaveBeenCalledWith(
                'Test Room',
                expect.objectContaining({ strictMode: true })
            );
        });

        it('should include custom patterns from config', async () => {
            mockPrisma.tempVoiceConfig.findUnique.mockResolvedValue({
                guildId: 'guild-123',
                strictMode: false,
                customPatterns: JSON.stringify(['custom.*pattern', 'another.*pattern']),
            });

            const mockService = new NameValidationService();
            vi.mocked(mockService.validate).mockResolvedValue({
                isAllowed: true,
                reasonCodes: [],
                matchedPatterns: [],
            } as any);

            const request = createMockRequest({
                method: 'POST',
                params: { guildId: 'guild-123' },
                body: {
                    name: 'Test Room',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            const data = response.data as any;
            expect(data.data.context.customPatternCount).toBe(2);
        });

        it('should return error for missing name', async () => {
            const request = createMockRequest({
                method: 'POST',
                params: { guildId: 'guild-123' },
                body: {},
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectError(response, 400);
            const data = response.data as any;
            expect(data.error.code).toBe('MISSING_NAME');
        });

        it('should return error for missing guildId', async () => {
            const request = createMockRequest({
                method: 'POST',
                params: {},
                body: {
                    name: 'Test Room',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectError(response, 400);
            const data = response.data as any;
            expect(data.error.code).toBe('MISSING_GUILD_ID');
        });

        it('should handle config not found gracefully', async () => {
            mockPrisma.tempVoiceConfig.findUnique.mockResolvedValue(null);

            const mockService = new NameValidationService();
            vi.mocked(mockService.validate).mockResolvedValue({
                isAllowed: true,
                reasonCodes: [],
                matchedPatterns: [],
            } as any);

            const request = createMockRequest({
                method: 'POST',
                params: { guildId: 'guild-123' },
                body: {
                    name: 'Test Room',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            expect(mockValidate).toHaveBeenCalledWith(
                'Test Room',
                expect.objectContaining({ strictMode: false })
            );
        });
    });
});
