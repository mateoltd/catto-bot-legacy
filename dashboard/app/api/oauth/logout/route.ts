import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { botApiUrl } from '@/lib/server/bot-api';

export async function POST() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('DASHBOARD_AUTH');

  // Invalidate session on the backend (non-critical — TTL handles expiry anyway)
  if (authCookie?.value) {
    try {
      await fetch(botApiUrl('/api/oauth/logout'), {
        method: 'POST',
        headers: {
          Cookie: `DASHBOARD_AUTH=${authCookie.value}`,
        },
      });
    } catch {
      // Ignore — session will expire via Redis TTL
    }
  }

  cookieStore.delete('DASHBOARD_AUTH');

  return NextResponse.json({ success: true });
}
