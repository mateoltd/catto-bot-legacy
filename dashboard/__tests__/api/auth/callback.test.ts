import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ALL mock state must be hoisted since vi.mock factory runs before module initialization
const { mockCookieStore, mockCookies } = vi.hoisted(() => {
  const mockCookieStore = {
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  };

  const mockCookies = vi.fn(() => mockCookieStore);

  return { mockCookieStore, mockCookies };
});

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('next/server', () => {
  class MockNextRequest {
    nextUrl: URL;
    url: string;
    headers: Headers;

    constructor(url: string) {
      this.nextUrl = new URL(url);
      this.url = url;
      this.headers = new Headers();
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: {
      redirect: (url: URL) => ({
        status: 307,
        headers: new Headers({ location: url.toString() }),
        redirectUrl: url.toString(),
      }),
    },
  };
});

import { GET } from '@/app/api/auth/callback/route';
import { NextRequest } from 'next/server';

describe('GET /api/auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Bot API unavailable')));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('redirects to / when no sessionId param', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/callback');
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  it('sets DASHBOARD_AUTH cookie with correct attributes', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/auth/callback?sessionId=test-session-123'
    );
    mockCookieStore.get.mockReturnValue(undefined);

    await GET(req);

    expect(mockCookieStore.set).toHaveBeenCalledWith('DASHBOARD_AUTH', 'test-session-123', {
      httpOnly: true,
      secure: false, // NODE_ENV is 'test', not 'production'
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
  });

  it('keeps DASHBOARD_AUTH host-only even when a legacy cookie domain is configured', async () => {
    vi.stubEnv('COOKIE_DOMAIN', '.catto.one');
    const req = new NextRequest(
      'https://dev.catto.one/api/auth/callback?sessionId=test-session-123'
    );
    mockCookieStore.get.mockReturnValue(undefined);

    await GET(req);

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'DASHBOARD_AUTH',
      'test-session-123',
      expect.not.objectContaining({ domain: expect.anything() })
    );
  });

  it('redirects to /guilds by default when no redirect cookie', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/auth/callback?sessionId=abc'
    );
    mockCookieStore.get.mockReturnValue(undefined);

    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/guilds');
  });

  it('uses and clears mod_auth_redirect after authentication', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/auth/callback?sessionId=abc'
    );
    mockCookieStore.get.mockReturnValue({ value: '/mod/guild-1/evidence' });

    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/mod/guild-1/evidence'
    );
    expect(mockCookieStore.delete).toHaveBeenCalledWith('mod_auth_redirect');
  });

  it('seeds the dashboard locale from Discord on first authentication', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ user: { locale: 'fr-CA' } }),
    );
    mockCookieStore.get.mockReturnValue(undefined);
    const req = new NextRequest(
      'http://localhost:3000/api/auth/callback?sessionId=abc',
    );

    await GET(req);

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'CATTO_DASH_LOCALE',
      'fr-FR',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
  });

  it('does not overwrite an explicit dashboard locale', async () => {
    mockCookieStore.get.mockImplementation((name: string) =>
      name === 'CATTO_DASH_LOCALE' ? { value: 'es-ES' } : undefined,
    );
    const req = new NextRequest(
      'http://localhost:3000/api/auth/callback?sessionId=abc',
    );

    await GET(req);

    expect(fetch).not.toHaveBeenCalled();
    expect(mockCookieStore.set).not.toHaveBeenCalledWith(
      'CATTO_DASH_LOCALE',
      expect.anything(),
      expect.anything(),
    );
  });
});
