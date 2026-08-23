import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const BOT_API_URL = process.env.NEXT_PUBLIC_BOT_API_URL || 'http://localhost:4000';

export async function POST() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('DASHBOARD_AUTH');

  // Invalidate session on the backend (non-critical — TTL handles expiry anyway)
  if (authCookie?.value) {
    try {
      await fetch(`${BOT_API_URL}/api/oauth/logout`, {
        method: 'POST',
        headers: {
          Cookie: `DASHBOARD_AUTH=${authCookie.value}`,
        },
      });
    } catch {
      // Ignore — session will expire via Redis TTL
    }
  }

  // Delete must specify the same domain used when setting the cookie
  if (process.env.COOKIE_DOMAIN) {
    cookieStore.set('DASHBOARD_AUTH', '', {
      maxAge: 0,
      path: '/',
      domain: process.env.COOKIE_DOMAIN,
    });
  } else {
    cookieStore.delete('DASHBOARD_AUTH');
  }

  return NextResponse.json({ success: true });
}
