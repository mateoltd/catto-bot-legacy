import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermissionGrantsRoute } from '#routes/guilds/permissions/grants.js';
import { createMockRequest, createMockResponse, createMockContainer, expectError, expectSuccess, expectValidationError } from '../../../helpers/test-helpers.js';

// Mock the permission resolver
vi.mock('#lib/validation/permissionResolver.js', () => ({
    listPermissionGrants: vi.fn(),
    createPermissionGrant: vi.fn(),
}));

import { listPermissionGrants, createPermissionGrant } from '#lib/validation/permissionResolver.js';

describe('PermissionGrantsRoute', () => {
    let route: PermissionGrantsRoute;
    let mockContainer: ReturnType<typeof createMockContainer>;

    beforeEach(() => {
        mockContainer = createMockContainer();
        // Create route instance - skip constructor to avoid Route parent initialization issues
        route = Object.create(PermissionGrantsRoute.prototype);
        // Mock the container getter
        Object.defineProperty(route, 'container', {
            get: () => mockContainer,
            configurable: true,
        });
        vi.clearAllMocks();
    });

    describe('GET /guilds/:guildId/permissions/grants', () => {
        it('lists all permission grants', async () => {
            const mockGrants = [
                {
                    id: 'grant-1',
                    guildId: '123456789',
                    subjectType: 'ROLE',
                    subjectId: '111222333444555666',
                    resourceType: 'COMMAND',
                    resourceKey: 'kick',
                    effect: 'ALLOW',
                    createdById: '987654321098765432',
                    createdAt: new Date('2024-01-01'),
                },
                {
                    id: 'grant-2',
                    guildId: '123456789',
                    subjectType: 'USER',
                    subjectId: '987654321098765432',
                    resourceType: 'MODULE',
                    resourceKey: 'moderation',
                    effect: 'DENY',
                    createdById: '987654321098765432',
                    createdAt: new Date('2024-01-02'),
                },
            ];

            vi.mocked(listPermissionGrants).mockResolvedValue(mockGrants as any);

            const request = createMockRequest({
                method: 'GET',
                params: { guildId: '123456789' },
                url: 'http://localhost/guilds/123456789/permissions/grants',
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            const data = response.data as any;
            expect(data.total).toBe(2);
            expect(data.grants).toHaveLength(2);
            expect(data.grants[0].id).toBe('grant-1');
        });

        it('filters by subjectType', async () => {
            vi.mocked(listPermissionGrants).mockResolvedValue([]);

            const request = createMockRequest({
                method: 'GET',
                params: { guildId: '123456789' },
                url: 'http://localhost/guilds/123456789/permissions/grants?subjectType=ROLE',
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            expect(listPermissionGrants).toHaveBeenCalledWith('123456789', {
                subjectType: 'ROLE',
            });
        });

        it('filters by multiple parameters', async () => {
            vi.mocked(listPermissionGrants).mockResolvedValue([]);

            const request = createMockRequest({
                method: 'GET',
                params: { guildId: '123456789' },
                url: 'http://localhost/guilds/123456789/permissions/grants?subjectType=USER&resourceType=COMMAND&resourceKey=kick',
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            expect(listPermissionGrants).toHaveBeenCalledWith('123456789', {
                subjectType: 'USER',
                resourceType: 'COMMAND',
                resourceKey: 'kick',
            });
        });

        it('returns empty list when no grants found', async () => {
            vi.mocked(listPermissionGrants).mockResolvedValue([]);

            const request = createMockRequest({
                method: 'GET',
                params: { guildId: '123456789' },
                url: 'http://localhost/guilds/123456789/permissions/grants',
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            const data = response.data as any;
            expect(data.total).toBe(0);
            expect(data.grants).toHaveLength(0);
        });

        it('handles service errors', async () => {
            vi.mocked(listPermissionGrants).mockRejectedValue(new Error('Database error'));

            const request = createMockRequest({
                method: 'GET',
                params: { guildId: '123456789' },
                url: 'http://localhost/guilds/123456789/permissions/grants',
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectError(response, 500);
        });
    });

    describe('POST /guilds/:guildId/permissions/grants', () => {
        it('creates a permission grant', async () => {
            const grantData = {
                subjectType: 'ROLE',
                subjectId: '111222333444555666',
                resourceType: 'COMMAND',
                resourceKey: 'kick',
                effect: 'ALLOW',
                createdById: '987654321098765432',
            };

            const createdGrant = {
                id: 'grant-1',
                guildId: '123456789',
                ...grantData,
                createdAt: new Date(),
            };

            vi.mocked(createPermissionGrant).mockResolvedValue(createdGrant as any);

            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: grantData,
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
            expect(createPermissionGrant).toHaveBeenCalledWith(
                '123456789',
                'ROLE',
                '111222333444555666',
                'COMMAND',
                'kick',
                'ALLOW',
                '987654321098765432'
            );
        });

        it('validates required fields', async () => {
            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: {
                    subjectType: 'ROLE',
                    // Missing subjectId, resourceType, resourceKey, effect, createdById
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response);
        });

        it('validates subjectType enum', async () => {
            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: {
                    subjectType: 'INVALID',
                    subjectId: '111222333444555666',
                    resourceType: 'COMMAND',
                    resourceKey: 'kick',
                    effect: 'ALLOW',
                    createdById: '987654321098765432',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response, 'subjectType');
        });

        it('validates resourceType enum', async () => {
            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: {
                    subjectType: 'ROLE',
                    subjectId: '111222333444555666',
                    resourceType: 'INVALID',
                    resourceKey: 'kick',
                    effect: 'ALLOW',
                    createdById: '987654321098765432',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response, 'resourceType');
        });

        it('validates effect enum', async () => {
            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: {
                    subjectType: 'ROLE',
                    subjectId: '111222333444555666',
                    resourceType: 'COMMAND',
                    resourceKey: 'kick',
                    effect: 'MAYBE',
                    createdById: '987654321098765432',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response, 'effect');
        });

        it('validates Discord IDs', async () => {
            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: {
                    subjectType: 'ROLE',
                    subjectId: 'invalid',
                    resourceType: 'COMMAND',
                    resourceKey: 'kick',
                    effect: 'ALLOW',
                    createdById: '987654321098765432',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response);
        });

        it('validates resourceKey format', async () => {
            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: {
                    subjectType: 'ROLE',
                    subjectId: '111222333444555666',
                    resourceType: 'COMMAND',
                    resourceKey: '', // Empty string
                    effect: 'ALLOW',
                    createdById: '987654321098765432',
                },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectValidationError(response, 'resourceKey');
        });

        it('creates DENY grant', async () => {
            const grantData = {
                subjectType: 'USER',
                subjectId: '987654321098765432',
                resourceType: 'MODULE',
                resourceKey: 'moderation',
                effect: 'DENY',
                createdById: '987654321098765432',
            };

            vi.mocked(createPermissionGrant).mockResolvedValue({
                id: 'grant-2',
                guildId: '123456789',
                ...grantData,
                createdAt: new Date(),
            } as any);

            const request = createMockRequest({
                method: 'POST',
                params: { guildId: '123456789' },
                body: grantData,
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectSuccess(response);
        });
    });

    describe('Error handling', () => {
        it('returns 400 when guild ID is missing', async () => {
            const request = createMockRequest({
                method: 'GET',
                params: {},
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectError(response, 400, 'Guild ID is required');
        });

        it('returns 404 for non-existent guild', async () => {
            const request = createMockRequest({
                method: 'GET',
                params: { guildId: 'nonexistent' },
                url: 'http://localhost/guilds/nonexistent/permissions/grants',
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectError(response, 404);
        });

        it('returns 405 for unsupported methods', async () => {
            const request = createMockRequest({
                method: 'DELETE',
                params: { guildId: '123456789' },
            });
            const response = createMockResponse();

            await route.run(request, response as any);

            expectError(response, 405);
        });
    });
});
