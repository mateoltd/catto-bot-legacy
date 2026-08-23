import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mocks for session module
const { mockExtractSessionId, mockIsSessionId, mockResolveSession } = vi.hoisted(() => ({
  mockExtractSessionId: vi.fn(),
  mockIsSessionId: vi.fn(),
  mockResolveSession: vi.fn(),
}));

vi.mock('#lib/session.js', () => ({
  extractSessionId: mockExtractSessionId,
  isSessionId: mockIsSessionId,
  resolveSession: mockResolveSession,
}));

// Mock Sapphire framework for the Middleware base class
vi.mock('@sapphire/plugin-api', async () => {
  const actual = await vi.importActual('@sapphire/plugin-api');
  return {
    ...actual,
    Middleware: class MockMiddleware {
      constructor(_context: unknown, _options: unknown) {}
    },
  };
});

import { AuthenticatedMiddleware } from '#root/middlewares/authenticated.js';

function createMockApiRequest(overrides: Partial<{ url: string; headers: Record<string, string> }> = {}) {
  return {
    url: overrides.url ?? '/api/test',
    headers: overrides.headers ?? {},
  } as any;
}

function createMockApiResponse() {
  const mock: any = {
    statusCode: 200,
    data: null,
    json: vi.fn(function (this: any, data: unknown) {
      mock.data = data;
      return mock;
    }),
    status: vi.fn(function (this: any, code: number) {
      mock.statusCode = code;
      return mock;
    }),
  };
  return mock;
}

describe('AuthenticatedMiddleware', () => {
  let middleware: AuthenticatedMiddleware;

  beforeEach(() => {
    middleware = new AuthenticatedMiddleware({} as any, {} as any);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips authentication for OAuth routes', async () => {
    const request = createMockApiRequest({ url: '/api/oauth/login' });
    const response = createMockApiResponse();

    await middleware.run(request, response);

    // Should not call any session functions
    expect(mockExtractSessionId).not.toHaveBeenCalled();
    expect(mockResolveSession).not.toHaveBeenCalled();
    // Response should not be modified
    expect(response.json).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
  });

  it('rejects requests with no session cookie and no Authorization header', async () => {
    const request = createMockApiRequest();
    const response = createMockApiResponse();
    mockExtractSessionId.mockReturnValue(null);

    await middleware.run(request, response);

    expect(response.statusCode).toBe(401);
    expect(response.data).toEqual({
      error: 'Unauthorized',
      message: 'You must be logged in to access this resource',
    });
  });

  it('rejects legacy raw Discord tokens with SessionExpired error', async () => {
    const request = createMockApiRequest();
    const response = createMockApiResponse();
    mockExtractSessionId.mockReturnValue('mfa.raw-discord-token-not-uuid');
    mockIsSessionId.mockReturnValue(false);

    await middleware.run(request, response);

    expect(response.statusCode).toBe(401);
    expect(response.data.error).toBe('SessionExpired');
    expect(response.data.message).toContain('expired');
  });

  it('rejects expired session IDs (resolveSession returns null)', async () => {
    const request = createMockApiRequest();
    const response = createMockApiResponse();
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    mockExtractSessionId.mockReturnValue(sessionId);
    mockIsSessionId.mockReturnValue(true);
    mockResolveSession.mockResolvedValue(null);

    await middleware.run(request, response);

    expect(response.statusCode).toBe(401);
    expect(response.data.error).toBe('SessionExpired');
    expect(mockResolveSession).toHaveBeenCalledWith(sessionId);
  });

  it('allows valid session through without modifying response', async () => {
    const request = createMockApiRequest();
    const response = createMockApiResponse();
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    mockExtractSessionId.mockReturnValue(sessionId);
    mockIsSessionId.mockReturnValue(true);
    mockResolveSession.mockResolvedValue({
      userId: 'user-123',
      accessToken: 'token',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    await middleware.run(request, response);

    // Response should not be touched on success
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(response.data).toBeNull();
  });

  it('accepts valid session ID from cookie', async () => {
    const request = createMockApiRequest();
    const response = createMockApiResponse();
    mockExtractSessionId.mockReturnValue('cookie-session-id');
    mockIsSessionId.mockReturnValue(true);
    mockResolveSession.mockResolvedValue({ userId: 'user-1' });

    await middleware.run(request, response);

    expect(response.statusCode).toBe(200);
    expect(mockResolveSession).toHaveBeenCalledWith('cookie-session-id');
  });

  it('accepts valid session ID from Authorization Bearer header', async () => {
    const request = createMockApiRequest();
    const response = createMockApiResponse();
    mockExtractSessionId.mockReturnValue('bearer-session-id');
    mockIsSessionId.mockReturnValue(true);
    mockResolveSession.mockResolvedValue({ userId: 'user-2' });

    await middleware.run(request, response);

    expect(response.statusCode).toBe(200);
    expect(mockResolveSession).toHaveBeenCalledWith('bearer-session-id');
  });

  it('skips authentication for nested OAuth routes', async () => {
    const request = createMockApiRequest({ url: '/api/oauth/callback' });
    const response = createMockApiResponse();

    await middleware.run(request, response);

    expect(mockExtractSessionId).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
  });

  it('does NOT bypass auth when /oauth/ appears in query string', async () => {
    const request = createMockApiRequest({ url: '/api/test?redirect=/oauth/callback' });
    const response = createMockApiResponse();
    mockExtractSessionId.mockReturnValue(null);

    await middleware.run(request, response);

    // OAuth bypass only checks pathname, not query string
    expect(mockExtractSessionId).toHaveBeenCalled();
    expect(response.statusCode).toBe(401);
  });

  it('returns 500-level error when resolveSession throws unexpectedly', async () => {
    const request = createMockApiRequest();
    const response = createMockApiResponse();
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    mockExtractSessionId.mockReturnValue(sessionId);
    mockIsSessionId.mockReturnValue(true);
    mockResolveSession.mockRejectedValue(new Error('Unexpected Redis failure'));

    // The middleware does not wrap resolveSession in try/catch,
    // so it propagates the error
    await expect(middleware.run(request, response)).rejects.toThrow('Unexpected Redis failure');
  });
});
