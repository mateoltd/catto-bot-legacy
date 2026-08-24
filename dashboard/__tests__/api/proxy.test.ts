import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { GET, POST } from '@/app/api/[...path]/route';

describe('bot API proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards same-origin API requests to the internal bot URL', async () => {
    mockFetch.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: 'https://discord.com/oauth2/authorize' },
      })
    );
    const request = new NextRequest('https://dev.catto.one/api/oauth/login?prompt=consent', {
      headers: { Host: 'dev.catto.one' },
    });
    request.cookies.set('DASHBOARD_AUTH', 'session-id');

    const response = await GET(request);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [target, init] = mockFetch.mock.calls[0];
    expect(target.toString()).toBe('http://localhost:4000/api/oauth/login?prompt=consent');
    expect(init).toMatchObject({ method: 'GET', body: undefined, redirect: 'manual' });
    expect(init.headers.get('cookie')).toBe('DASHBOARD_AUTH=session-id');
    expect(init.headers.has('host')).toBe(false);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://discord.com/oauth2/authorize');
  });

  it('forwards request bodies and methods', async () => {
    mockFetch.mockResolvedValue(Response.json({ success: true }));
    const request = new NextRequest('https://dash.catto.one/api/guilds/123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });

    await POST(request);

    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(new TextDecoder().decode(init.body)).toBe('{"enabled":true}');
  });

  it('returns a safe gateway error when the bot API is unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockFetch.mockRejectedValue(new Error('connection refused'));
    const request = new NextRequest('https://dash.catto.one/api/users/@me');

    const response = await GET(request);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'Bot API unavailable' });
  });
});
