'use client';

import useSWR from 'swr';
import { voiceXPService, type VoiceXPConfig } from '@/lib/services/voice-xp.service';

export function useVoiceXPConfig(guildId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    ['voice-xp-config', guildId],
    () => voiceXPService.getConfig(guildId),
    { revalidateOnFocus: false },
  );

  const updateConfig = async (updates: Partial<VoiceXPConfig>) => {
    try {
      const updated = await voiceXPService.updateConfig(guildId, updates);
      await mutate(updated, { revalidate: false });
      return { success: true, data: updated };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update config';
      return { success: false, error: errorMessage };
    }
  };

  return {
    config: data ?? null,
    loading: isLoading,
    error: error instanceof Error ? error.message : error ? 'Failed to fetch config' : null,
    updateConfig,
    refetch: () => mutate(),
  };
}
