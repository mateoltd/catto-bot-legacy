import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockCookieStore, mockCookies } = vi.hoisted(() => {
  const mockCookieStore = { set: vi.fn() };
  return {
    mockCookieStore,
    mockCookies: vi.fn(() => mockCookieStore),
  };
});

vi.mock('next/headers', () => ({ cookies: mockCookies }));

import { POST } from '@/app/api/locale/route';

describe('POST /api/locale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists a supported locale in a host-only preference cookie', async () => {
    const request = new NextRequest('https://dash.catto.one/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'es-ES' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ locale: 'es-ES' });
    expect(mockCookieStore.set).toHaveBeenCalledWith('CATTO_DASH_LOCALE', 'es-ES', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'CATTO_DASH_LOCALE',
      'es-ES',
      expect.not.objectContaining({ domain: expect.anything() }),
    );
  });

  it('rejects unsupported and malformed locale payloads', async () => {
    const unsupportedRequest = new NextRequest('https://dash.catto.one/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'de-DE' }),
    });
    const malformedRequest = new NextRequest('https://dash.catto.one/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });

    expect((await POST(unsupportedRequest)).status).toBe(400);
    expect((await POST(malformedRequest)).status).toBe(400);
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });
});
