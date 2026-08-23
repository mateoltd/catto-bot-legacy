import axios from 'axios';
import { cookies } from 'next/headers';
import { unstable_cache } from 'next/cache';
import type { DiscordUser, UserSession } from './types';

const BOT_API_URL = process.env.NEXT_PUBLIC_BOT_API_URL || 'http://localhost:4000';

/**
 * Get the current authenticated user and their guilds from the session cookie
 */
export async function getCurrentUser(): Promise<DiscordUser | null> {
  const session = await getUserSession();
  return session?.user || null;
}

/**
 * Get the full user session including guilds (internal, uncached)
 */
async function fetchUserSession(token: string): Promise<UserSession | null> {
  try {
    console.log('Fetching user session from bot API...');
    const response = await axios.get(`${BOT_API_URL}/api/users/@me`, {
      headers: {
        Cookie: `DASHBOARD_AUTH=${token}`,
      },
      withCredentials: true,
      validateStatus: (status) => status < 500,
    });

    console.log('Bot API response:', response.status);

    if (response.status === 200 && response.data.user) {
      return {
        user: response.data.user,
        guilds: response.data.guilds || [],
      };
    }

    return null;
  } catch (error) {
    console.error('fetchUserSession error:', error);
    return null;
  }
}

/**
 * Get the full user session including guilds (cached version)
 */
export async function getUserSession(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get('DASHBOARD_AUTH');

    if (!authCookie) {
      return null;
    }

    // Create a cached version of the fetch function per user token
    // Cache is valid for 5 minutes
    const getCachedSession = unstable_cache(
      async (token: string) => fetchUserSession(token),
      ['user-session'],
      {
        revalidate: 300, // Cache for 5 minutes
        tags: [`user-${authCookie.value}`],
      }
    );

    return await getCachedSession(authCookie.value);
  } catch (error) {
    console.error('getUserSession error:', error);
    return null;
  }
}

/**
 * Logout action - clears the auth cookie
 */
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('DASHBOARD_AUTH');
}
