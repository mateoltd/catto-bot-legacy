import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// We need to import the middleware function - since it uses env vars directly,
// we test the exported middleware function
import { middleware } from '@/middleware';

function createRequest(pathname: string, cookies: Record<string, string> = {}) {
  const url = `http://localhost:3000${pathname}`;
  const req = new NextRequest(url);
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

describe('Dashboard Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects to /mod/login when no session cookie on /mod route', async () => {
    const req = createRequest('/mod/cases');
    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/mod/login');
  });

  it('allows /mod/login without session cookie', async () => {
    const req = createRequest('/mod/login');
    const res = await middleware(req);

    // Should pass through (NextResponse.next())
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('preserves intended destination in mod_auth_redirect cookie on redirect', async () => {
    const req = createRequest('/mod/guild-123/evidence');
    const res = await middleware(req);

    expect(res.status).toBe(307);
    // Check that mod_auth_redirect cookie is set
    const setCookie = res.headers.getSetCookie();
    const redirectCookie = setCookie.find((c: string) => c.includes('mod_auth_redirect'));
    expect(redirectCookie).toBeDefined();
    // Cookie value is URL-encoded by Next.js
    expect(redirectCookie).toContain('mod_auth_redirect=');
    expect(decodeURIComponent(redirectCookie!)).toContain('/mod/guild-123/evidence');
  });

  it('validates session against bot API on protected routes', async () => {
    mockFetch.mockResolvedValue({ status: 200 });

    const req = createRequest('/mod/cases', { DASHBOARD_AUTH: 'valid-session-id' });
    const res = await middleware(req);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/users/@me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: 'DASHBOARD_AUTH=valid-session-id',
        }),
      })
    );

    // Should return NextResponse.next() (status 200, no redirect)
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('clears cookie and redirects on 401 response', async () => {
    mockFetch.mockResolvedValue({ status: 401 });

    const req = createRequest('/mod/cases', { DASHBOARD_AUTH: 'expired-session' });
    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/mod/login');
    // Should have cookie deletion header
    const setCookie = res.headers.getSetCookie();
    const authCookie = setCookie.find((c: string) => c.includes('DASHBOARD_AUTH'));
    expect(authCookie).toBeDefined();
    // Verify it is a deletion cookie (max-age=0 or empty value)
    expect(authCookie).toMatch(/max-age=0|DASHBOARD_AUTH=(?:;|$)/i);
  });

  it('allows through on network error (graceful degradation)', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const req = createRequest('/mod/cases', { DASHBOARD_AUTH: 'valid-session' });
    const res = await middleware(req);

    // Should pass through, not redirect
    expect(res.status).toBe(200);
  });

  it('allows through on non-401 error response (graceful degradation)', async () => {
    mockFetch.mockResolvedValue({ status: 500 });

    const req = createRequest('/mod/cases', { DASHBOARD_AUTH: 'valid-session' });
    const res = await middleware(req);

    // Should pass through (next()), not redirect — same as network error
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('does not protect non-mod routes', async () => {
    const req = createRequest('/about');
    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sets mod_auth_redirect on 401 redirect', async () => {
    mockFetch.mockResolvedValue({ status: 401 });

    const req = createRequest('/mod/guild-1/analytics', { DASHBOARD_AUTH: 'expired' });
    const res = await middleware(req);

    const setCookie = res.headers.getSetCookie();
    const redirectCookie = setCookie.find((c: string) => c.includes('mod_auth_redirect'));
    expect(redirectCookie).toBeDefined();
    expect(decodeURIComponent(redirectCookie!)).toContain('/mod/guild-1/analytics');
  });
});
