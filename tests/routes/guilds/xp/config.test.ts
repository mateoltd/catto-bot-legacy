import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XPConfigRoute } from '#routes/guilds/xp/config.js';
import { createMockRequest, createMockResponse, createMockContainer, expectError, expectSuccess, expectValidationError } from '../../../helpers/test-helpers.js';

// Mock the services
vi.mock('#root/modules/xp/xp-text/index.js', () => ({
    configService: {
        getConfig: vi.fn(),
        updateConfig: vi.fn(),
    },
}));

vi.mock('#lib/route-utils.js', () => ({
    parseRequestBody: vi.fn((req) => Promise.resolve(req.body)),
}));

import { configService } from '#root/modules/xp/xp-text/index.js';

describe('XPConfigRoute', () => {
    let route: XPConfigRoute;
    let mockContainer: ReturnType<typeof createMockContainer>;

    beforeEach(() => {
        mockContainer = createMockContainer();
        // Create route instance - skip constructor to avoid Route parent initialization issues
        route = Object.create(XPConfigRoute.prototype);
        // Mock the container getter
        Object.defineProperty(route, 'container', {
            get: () => mockContainer,
            configurable: true,
        });
        vi.clearAllMocks();
    });

    describe('GET /guilds/:guildId/xp/config', () => {
        it('returns XP configuration', async () => {
            const mockConfig = {
                guildId: '123456789',
                enabled: true,
                cooldownSec: 60,
                xpMode: 'RANDOM',
                minXp: 10,
                maxXp: 20,
            };

            vi.mocked(configService.getConfig).mockResolvedValue(mockConfig as any);

            const request = createMockRequest({
                method: 'GET',
                params: { guildId: '123456789' },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            expect(response.data).toEqual({
                success: true,
                config: mockConfig,
            });
            expect(configService.getConfig).toHaveBeenCalledWith('123456789');
        });

        it('returns 404 for non-existent guild', async () => {
            const request = createMockRequest({
                method: 'GET',
                params: { guildId: 'nonexistent' },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectError(response, 404, 'Guild not found');
        });

        it('returns 400 when guild ID is missing', async () => {
            const request = createMockRequest({
                method: 'GET',
                params: {},
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectError(response, 400, 'Guild ID is required');
        });

        it('handles service errors', async () => {
            vi.mocked(configService.getConfig).mockRejectedValue(new Error('Database error'));

            const request = createMockRequest({
                method: 'GET',
                params: { guildId: '123456789' },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectError(response, 500, 'Internal server error');
        });
    });

    describe('PUT /guilds/:guildId/xp/config', () => {
        it('updates XP configuration', async () => {
            const updateData = {
                enabled: true,
                cooldownSec: 120,
                xpMode: 'FIXED',
                fixedXp: 15,
            };

            const updatedConfig = {
                guildId: '123456789',
                ...updateData,
            };

            vi.mocked(configService.updateConfig).mockResolvedValue(updatedConfig as any);

            const request = createMockRequest({
                method: 'PUT',
                params: { guildId: '123456789' },
                body: updateData,
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            expect(configService.updateConfig).toHaveBeenCalledWith(
                '123456789',
                expect.objectContaining(updateData)
            );
        });

        it('normalizes legacy levelCurveType values to FORMULA', async () => {
            vi.mocked(configService.updateConfig).mockResolvedValue({
                guildId: '123456789',
                levelCurveType: 'FORMULA',
            } as any);

            const request = createMockRequest({
                method: 'PUT',
                params: { guildId: '123456789' },
                body: { levelCurveType: 'LINEAR' },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            expect(configService.updateConfig).toHaveBeenCalledWith(
                '123456789',
                expect.objectContaining({ levelCurveType: 'FORMULA' })
            );
        });

        it('validates cooldownSec range', async () => {
            const request = createMockRequest({
                method: 'PUT',
                params: { guildId: '123456789' },
                body: { cooldownSec: -1 },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response, 'cooldownSec');
        });

        it('validates xpMode enum', async () => {
            const request = createMockRequest({
                method: 'PUT',
                params: { guildId: '123456789' },
                body: { xpMode: 'INVALID' },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response, 'xpMode');
        });

        it('validates Discord IDs in arrays', async () => {
            const request = createMockRequest({
                method: 'PUT',
                params: { guildId: '123456789' },
                body: {
                    allowedChannels: ['invalid', '123'],
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response);
        });

        it('validates embedColor range', async () => {
            const request = createMockRequest({
                method: 'PUT',
                params: { guildId: '123456789' },
                body: { embedColor: 16777216 }, // > 0xFFFFFF
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response, 'embedColor');
        });

        it('accepts null values for nullable fields', async () => {
            const updateData = {
                announceChannelId: null,
                maxXpPerMinute: null,
            };

            vi.mocked(configService.updateConfig).mockResolvedValue({
                guildId: '123456789',
                ...updateData,
            } as any);

            const request = createMockRequest({
                method: 'PUT',
                params: { guildId: '123456789' },
                body: updateData,
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
        });

        it('validates table thresholds', async () => {
            const request = createMockRequest({
                method: 'PUT',
                params: { guildId: '123456789' },
                body: {
                    levelCurveType: 'TABLE',
                    tableThresholds: [], // Empty array not allowed
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response, 'tableThresholds');
        });

        it('accepts complex valid configuration', async () => {
            const complexConfig = {
                enabled: true,
                cooldownSec: 60,
                xpMode: 'RANDOM',
                minXp: 10,
                maxXp: 20,
                minMessageLength: 5,
                allowedChannels: ['123456789012345678'],
                ignoredChannels: ['987654321098765432'],
                ignoredRoles: ['111222333444555666'],
                announceLevelUp: true,
                announceChannelId: '123456789012345678',
                messageTemplate: 'Congrats {user}!',
                embedEnabled: true,
                embedColor: 0x5865f2,
                levelCurveType: 'FORMULA',
                formulaBase: 100,
                formulaExponent: 1.2,
                formulaOffset: 0,
            };

            vi.mocked(configService.updateConfig).mockResolvedValue({
                guildId: '123456789',
                ...complexConfig,
            } as any);

            const request = createMockRequest({
                method: 'PUT',
                params: { guildId: '123456789' },
                body: complexConfig,
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
        });

        it('returns 400 when body is missing', async () => {
            const request = createMockRequest({
                method: 'PUT',
                params: { guildId: '123456789' },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectError(response, 400);
        });
    });

    describe('HTTP method handling', () => {
        it('returns 405 for unsupported methods', async () => {
            const request = createMockRequest({
                method: 'DELETE',
                params: { guildId: '123456789' },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectError(response, 405, 'Method not allowed');
        });

        it('supports GET method', async () => {
            vi.mocked(configService.getConfig).mockResolvedValue({} as any);

            const request = createMockRequest({
                method: 'GET',
                params: { guildId: '123456789' },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expect(response.statusCode).not.toBe(405);
        });

        it('supports PUT method', async () => {
            vi.mocked(configService.updateConfig).mockResolvedValue({} as any);

            const request = createMockRequest({
                method: 'PUT',
                params: { guildId: '123456789' },
                body: { enabled: true },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expect(response.statusCode).not.toBe(405);
        });
    });
});
