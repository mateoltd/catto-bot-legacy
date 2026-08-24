import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  matchAcceptLanguage,
  matchSupportedLocale,
} from '@/i18n/config';
import { botApiUrl } from '@/lib/server/bot-api';

async function getInitialLocale(request: NextRequest, sessionId: string) {
  try {
    const response = await fetch(botApiUrl('/api/users/@me'), {
      headers: { Cookie: `DASHBOARD_AUTH=${sessionId}` },
      cache: 'no-store',
    });
    if (response.ok) {
      const payload = (await response.json()) as { user?: { locale?: unknown } };
      const discordLocale =
        typeof payload.user?.locale === 'string'
          ? matchSupportedLocale(payload.user.locale)
          : null;
      if (discordLocale) return discordLocale;
    }
  } catch {
    // Locale detection is non-critical; browser preferences remain available.
  }

  return matchAcceptLanguage(request.headers.get('accept-language')) ?? DEFAULT_LOCALE;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  // Legacy raw-token param — force re-login
  if (!sessionId) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const cookieStore = await cookies();

  // Keep the opaque session cookie host-only so environments cannot share sessions.
  const cookieOptions: Parameters<typeof cookieStore.set>[2] = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  };
  cookieStore.set('DASHBOARD_AUTH', sessionId, cookieOptions);

  if (!cookieStore.get(LOCALE_COOKIE_NAME)) {
    cookieStore.set(LOCALE_COOKIE_NAME, await getInitialLocale(request, sessionId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: LOCALE_COOKIE_MAX_AGE,
      path: '/',
    });
  }

  // Check if there's a redirect destination (e.g. set by /mod/login)
  const redirectCookie = cookieStore.get('mod_auth_redirect');
  let destination = '/guilds';

  // Only allow same-origin relative paths
  if (redirectCookie?.value?.startsWith('/') && !redirectCookie.value.startsWith('//')) {
    destination = redirectCookie.value;
  }

  // Clear the redirect cookie
  if (redirectCookie) {
    cookieStore.delete('mod_auth_redirect');
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
