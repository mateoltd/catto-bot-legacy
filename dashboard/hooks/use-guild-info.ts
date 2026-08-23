'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useUserMe } from '@/hooks/use-user-me';

interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
}

/**
 * Pre-populate guild info into sessionStorage so the sidebar loads instantly
 * when navigating from the server picker. Call this before navigation.
 */
export function cacheGuildInfo(guild: { id: string; name: string; icon: string | null }) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`guild-info:${guild.id}`, JSON.stringify(guild));
}

const noop = () => () => {};

export function useGuildInfo(guildId: string): GuildInfo | null {
  const userMe = useUserMe();
  const cachedRaw = useSyncExternalStore(
    noop,
    () => sessionStorage.getItem(`guild-info:${guildId}`),
    () => null,
  );

  return useMemo(() => {
    // If we have fresh API data, use it and update the cache
    const guild = userMe?.guilds?.find((g) => g.id === guildId);
    if (guild) {
      const info: GuildInfo = { id: guild.id, name: guild.name, icon: guild.icon };
      sessionStorage.setItem(`guild-info:${guildId}`, JSON.stringify(info));
      return info;
    }

    // Fall back to sessionStorage cache (populated by cacheGuildInfo before navigation)
    if (cachedRaw) {
      try {
        return JSON.parse(cachedRaw) as GuildInfo;
      } catch {}
    }

    return null;
  }, [userMe, guildId, cachedRaw]);
}
