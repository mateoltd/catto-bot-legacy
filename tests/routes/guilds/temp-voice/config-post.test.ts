import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TempVoiceConfigPostRoute } from '#routes/guilds/temp-voice/config-post.js';
import { createMockRequest, createMockResponse, createMockContainer, expectError, expectSuccess, expectValidationError } from '../../../helpers/test-helpers.js';
import { TempVoiceConfigServiceStatic } from '#modules/temp-voice/services/config-api.service.js';

const { mockApiGateFromRequest } = vi.hoisted(() => ({
    mockApiGateFromRequest: vi.fn(),
}));

vi.mock('#lib/validation/ApiGate.js', () => ({
    ApiGate: { fromRequest: mockApiGateFromRequest },
}));

// Mock the service - using the correct import path and service name
vi.mock('#modules/temp-voice/services/config-api.service.js', () => ({
    TempVoiceConfigurationDrainingError: class TempVoiceConfigurationDrainingError extends Error {},
    TempVoiceConfigServiceStatic: {
        getConfig: vi.fn(),
        createConfig: vi.fn(),
    },
}));

vi.mock('#lib/route-utils.js', () => ({
    parseRequestBody: vi.fn((req) => Promise.resolve(req.body)),
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



describe('TempVoiceConfigPostRoute', () => {
    let route: TempVoiceConfigPostRoute;
    let mockContainer: ReturnType<typeof createMockContainer>;

    beforeEach(() => {
        // Create mock channels for the guild
        const mockVoiceChannel = {
            id: '123456789012345678',
            type: 2, // Voice channel
            isVoiceBased: () => true,
        };
        
        const mockChannelsCache = new Map([
            ['123456789012345678', mockVoiceChannel],
        ]);

        // Create mock guild with channels
        const mockGuild = {
            id: '123456789',
            name: 'Test Guild',
            channels: {
                cache: mockChannelsCache,
            },
        };

        const mockGuildsCache = new Map([
            ['123456789', mockGuild],
        ]);

        mockContainer = createMockContainer({
            client: {
                guilds: {
                    cache: mockGuildsCache as any,
                },
            },
        });
        
        // Create route instance - skip constructor to avoid Route parent initialization issues
        route = Object.create(TempVoiceConfigPostRoute.prototype);
        // Mock the container getter
        Object.defineProperty(route, 'container', {
            get: () => mockContainer,
            configurable: true,
        });
        
        // Setup default mocks
        vi.mocked(TempVoiceConfigServiceStatic.getConfig).mockResolvedValue(null); // No existing config by default
        mockApiGateFromRequest.mockResolvedValue(createMockGate());

        vi.clearAllMocks();
        mockApiGateFromRequest.mockResolvedValue(createMockGate());
    });

    describe('POST /guilds/:guildId/temp-voice/config', () => {
        it('creates temp voice configuration', async () => {
            const configData = {
                enabled: true,
                joinChannelIds: ['123456789012345678'],
                bitrate: 96000,
                userLimit: 10,
                namingScheme: 'username',
            };

            const createdConfig = {
                id: 'config-1',
                guildId: '123456789',
                ...configData,
            };

            vi.mocked(TempVoiceConfigServiceStatic.createConfig).mockResolvedValue(createdConfig as any);

            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: configData,
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            expect(TempVoiceConfigServiceStatic.createConfig).toHaveBeenCalledWith(
                '123456789',
                expect.objectContaining(configData)
            );
        });

        it('validates joinChannelIds is required', async () => {
            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: {
                    bitrate: 96000,
                    namingScheme: 'username',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response, 'joinChannelIds');
        });

        it('validates joinChannelIds format', async () => {
            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: {
                    joinChannelIds: ['invalid'],
                    namingScheme: 'username',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response);
        });

        it('validates bitrate range', async () => {
            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: {
                    joinChannelIds: ['123456789012345678'],
                    bitrate: 7999, // Below minimum
                    namingScheme: 'username',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response, 'bitrate');
        });

        it('validates userLimit range', async () => {
            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: {
                    joinChannelIds: ['123456789012345678'],
                    userLimit: 100, // Above maximum
                    namingScheme: 'username',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response, 'userLimit');
        });

        it('accepts 0 as userLimit (unlimited)', async () => {
            const configData = {
                joinChannelIds: ['123456789012345678'],
                userLimit: 0,
                namingScheme: 'username',
            };

            vi.mocked(TempVoiceConfigServiceStatic.createConfig).mockResolvedValue({
                guildId: '123456789',
                ...configData,
            } as any);

            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: configData,
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
        });

        it('validates namingScheme enum', async () => {
            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: {
                    joinChannelIds: ['123456789012345678'],
                    namingScheme: 'INVALID_SCHEME',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response, 'namingScheme');
        });

        it('validates customNamingPattern length', async () => {
            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: {
                    joinChannelIds: ['123456789012345678'],
                    customNamingPattern: 'a'.repeat(101), // Too long
                    namingScheme: 'custom',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response, 'customNamingPattern');
        });

        it('accepts minimal valid configuration', async () => {
            const minimalConfig = {
                joinChannelIds: ['123456789012345678'],
                namingScheme: 'username',
            };

            vi.mocked(TempVoiceConfigServiceStatic.createConfig).mockResolvedValue({
                guildId: '123456789',
                ...minimalConfig,
            } as any);

            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: minimalConfig,
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
        });

        it('returns 404 for non-existent guild', async () => {
            const request = createMockRequest({
                method: 'POST',
                params: { guildId: 'nonexistent' },
                body: {
                    joinChannelIds: ['123456789012345678'],
                    namingScheme: 'username',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectError(response, 404);
        });

        it('returns 400 when body is missing', async () => {
            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectError(response, 400);
        });

        it('handles service errors', async () => {
            vi.mocked(TempVoiceConfigServiceStatic.createConfig).mockRejectedValue(
                new Error('Database error')
            );

            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: {
                    joinChannelIds: ['123456789012345678'],
                    namingScheme: 'username',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectError(response, 500);
        });
    });
});
