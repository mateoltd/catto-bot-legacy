'use client';

import useSWR from 'swr';
import { textXPService, type XPConfig } from '@/lib/services/text-xp.service';

export function useTextXPConfig(guildId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    ['text-xp-config', guildId],
    () => textXPService.getConfig(guildId),
    { revalidateOnFocus: false },
  );

  const updateConfig = async (updates: Partial<XPConfig>) => {
    try {
      const updated = await textXPService.updateConfig(guildId, updates);
      await mutate(updated, { revalidate: false });
      return { success: true, data: updated.config };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update config';
      return { success: false, error: errorMessage };
    }
  };

  return {
    config: data?.config ?? null,
    loading: isLoading,
    error: error instanceof Error ? error.message : error ? 'Failed to fetch config' : null,
    updateConfig,
    refetch: () => mutate(),
  };
}
