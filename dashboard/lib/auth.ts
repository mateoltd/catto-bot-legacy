import { cookies } from 'next/headers';
import type { DiscordUser, UserSession } from './types';
import { botApiUrl } from './server/bot-api';

export async function getCurrentUser(): Promise<DiscordUser | null> {
  const session = await getUserSession();
  return session?.user ?? null;
}

async function fetchUserSession(token: string): Promise<UserSession | null> {
  try {
    const response = await fetch(botApiUrl('/api/users/@me'), {
      headers: {
        Cookie: `DASHBOARD_AUTH=${token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as Partial<UserSession>;
    if (!payload.user) return null;

    return {
      user: payload.user,
      guilds: payload.guilds ?? [],
    };
  } catch {
    return null;
  }
}

export async function getUserSession(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('DASHBOARD_AUTH')?.value;
    return token ? await fetchUserSession(token) : null;
  } catch {
    return null;
  }
}
