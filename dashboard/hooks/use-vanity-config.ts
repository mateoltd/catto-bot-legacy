'use client';

import useSWR from 'swr';
import { vanityService } from '@/lib/services/vanity.service';

export function useVanityConfig(guildId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    ['vanity-config', guildId],
    () => vanityService.getConfig(guildId),
    { revalidateOnFocus: false },
  );

  return {
    config: data?.config ?? null,
    loading: isLoading,
    error:
      error instanceof Error ? error.message : error ? 'Failed to fetch vanity settings' : null,
    mutate,
  };
}
