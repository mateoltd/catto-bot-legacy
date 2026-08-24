import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { botApiUrl } from '@/lib/server/bot-api';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/mod') || pathname === '/mod/login') return NextResponse.next();

  const sessionCookie = request.cookies.get('DASHBOARD_AUTH');
  if (!sessionCookie?.value) return redirectToLogin(request, pathname);

  try {
    const response = await fetch(botApiUrl('/api/users/@me'), {
      headers: { Cookie: `DASHBOARD_AUTH=${sessionCookie.value}` },
    });

    if (response.status === 401) {
      const redirectResponse = redirectToLogin(request, pathname);
      redirectResponse.cookies.delete('DASHBOARD_AUTH');
      return redirectResponse;
    }
  } catch {
    // The page-level session check owns outage handling when the bot API cannot be reached.
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest, destination: string) {
  const response = NextResponse.redirect(new URL('/mod/login', request.url));
  response.cookies.set('mod_auth_redirect', destination, {
    maxAge: 300,
    path: '/',
    sameSite: 'lax',
  });
  return response;
}

export const config = {
  matcher: ['/mod', '/mod/:path*'],
};
