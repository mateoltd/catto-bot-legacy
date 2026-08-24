'use client';

import useSWR from 'swr';

interface UserInfo {
  id: string;
  username: string;
  avatar: string | null;
  global_name: string | null;
}

interface GuildEntry {
  id: string;
  name: string;
  icon: string | null;
}

export interface UserMeData {
  user: UserInfo;
  guilds: GuildEntry[];
}

async function fetchUserMe(): Promise<UserMeData> {
  const res = await fetch('/api/users/@me', { credentials: 'include' });
  const data = await res.json();
  if (!data?.user) throw new Error('No user data');
  return data as UserMeData;
}

export function useUserMe(): UserMeData | null {
  const { data } = useSWR('user-me', fetchUserMe, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  return data ?? null;
}
