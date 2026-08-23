import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BOT_API_URL = process.env.NEXT_PUBLIC_BOT_API_URL || 'http://localhost:4000';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /mod/* routes (exclude /mod/login itself)
  if (pathname.startsWith('/mod') && pathname !== '/mod/login') {
    const sessionCookie = request.cookies.get('DASHBOARD_AUTH');

    if (!sessionCookie?.value) {
      const loginUrl = new URL('/mod/login', request.url);
      const res = NextResponse.redirect(loginUrl);
      // Save the intended destination so login can redirect back
      res.cookies.set('mod_auth_redirect', pathname, {
        maxAge: 300,
        path: '/',
        sameSite: 'lax',
      });
      return res;
    }

    // Validate session by calling the bot API
    try {
      const response = await fetch(`${BOT_API_URL}/api/users/@me`, {
        headers: {
          Cookie: `DASHBOARD_AUTH=${sessionCookie.value}`,
        },
      });

      if (response.status === 401) {
        // Session is invalid or expired - redirect to login and clear cookie
        const loginUrl = new URL('/mod/login', request.url);
        const res = NextResponse.redirect(loginUrl);
        res.cookies.delete('DASHBOARD_AUTH');
        // Save the intended destination so login can redirect back
        res.cookies.set('mod_auth_redirect', pathname, {
          maxAge: 300,
          path: '/',
          sameSite: 'lax',
        });
        return res;
      }
    } catch {
      // If validation fails due to network error, allow through and let page handle it
      // This prevents blocking users if the bot API is temporarily unavailable
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/mod', '/mod/:path*'],
};
