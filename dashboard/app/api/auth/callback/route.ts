import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  // Legacy raw-token param — force re-login
  if (!sessionId) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const cookieStore = await cookies();

  // Set the auth cookie (value is now the opaque session ID)
  // COOKIE_DOMAIN (e.g. ".catto.one") shares the cookie across subdomains
  // so client-side requests to the bot API subdomain include it.
  const cookieOptions: Parameters<typeof cookieStore.set>[2] = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  };
  if (process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }
  cookieStore.set('DASHBOARD_AUTH', sessionId, cookieOptions);

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
