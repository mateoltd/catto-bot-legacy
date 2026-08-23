export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getUserSession } from '@/lib/auth';
import { ServerPicker } from '@/components/mod/server-picker';

const BOT_API_URL = process.env.NEXT_PUBLIC_BOT_API_URL || 'http://localhost:4000';

/**
 * Full check: bot presence + user membership + dashboard permissions.
 * Requires the POST /api/guilds/accessible route on the bot.
 */
async function getAccessibleGuildIds(
  guildIds: string[],
  authCookie: string
): Promise<string[] | null> {
  try {
    const res = await fetch(`${BOT_API_URL}/api/guilds/accessible`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `DASHBOARD_AUTH=${authCookie}`,
      },
      body: JSON.stringify({ guildIds }),
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.guildIds ?? null;
  } catch {
    return null;
  }
}

/**
 * Lightweight fallback: return the set of guild IDs the bot is currently in.
 * Uses the existing GET /api/guilds endpoint (always available).
 */
async function getBotGuildIds(authCookie: string): Promise<Set<string> | null> {
  try {
    const res = await fetch(`${BOT_API_URL}/api/guilds`, {
      headers: { Cookie: `DASHBOARD_AUTH=${authCookie}` },
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const data = await res.json();
    return new Set((data.guilds as { id: string }[]).map((g) => g.id));
  } catch {
    return null;
  }
}

export default async function ModDashboardHome() {
  const session = await getUserSession();
  if (!session) redirect('/mod/login');

  const cookieStore = await cookies();
  const authCookie = cookieStore.get('DASHBOARD_AUTH')?.value;

  let filteredGuilds = session.guilds;

  if (authCookie && session.guilds.length > 0) {
    // Ask bot which guilds are accessible (bot presence + membership + Gate perms)
    const accessibleIds = await getAccessibleGuildIds(
      session.guilds.map((g) => g.id),
      authCookie
    );

    if (accessibleIds) {
      const idSet = new Set(accessibleIds);
      filteredGuilds = session.guilds.filter((g) => idSet.has(g.id));
    } else {
      // Fallback: at least filter by bot presence using existing endpoint
      const botGuildIds = await getBotGuildIds(authCookie);
      if (botGuildIds) {
        filteredGuilds = session.guilds.filter((g) => botGuildIds.has(g.id));
      }
    }
  }

  return (
    <ServerPicker
      session={{
        user: {
          id: session.user.id,
          username: session.user.username,
          avatar: session.user.avatar,
        },
        guilds: filteredGuilds,
      }}
    />
  );
}
