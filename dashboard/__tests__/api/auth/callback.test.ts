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

    constructor(url: string) {
      this.nextUrl = new URL(url);
      this.url = url;
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

  it('redirects to / when sessionId is empty string', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/callback?sessionId=');
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

  it('uses mod_auth_redirect value for redirect destination', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/auth/callback?sessionId=abc'
    );
    mockCookieStore.get.mockReturnValue({ value: '/mod/guild-1/evidence' });

    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/mod/guild-1/evidence'
    );
  });

  it('deletes mod_auth_redirect cookie after use', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/auth/callback?sessionId=abc'
    );
    mockCookieStore.get.mockReturnValue({ value: '/mod/cases' });

    await GET(req);

    expect(mockCookieStore.delete).toHaveBeenCalledWith('mod_auth_redirect');
  });

  it('does not delete mod_auth_redirect when it does not exist', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/auth/callback?sessionId=abc'
    );
    mockCookieStore.get.mockReturnValue(undefined);

    await GET(req);

    expect(mockCookieStore.delete).not.toHaveBeenCalled();
  });
});
