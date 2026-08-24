'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { loggingService, type LogConfig } from '@/lib/services/logging.service';

export function useLoggingConfig(guildId: string) {
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: config, error, isLoading, mutate } = useSWR<LogConfig>(
    ['logging-config', guildId],
    () => loggingService.getConfig(guildId),
    { revalidateOnFocus: false },
  );

  const updateConfig = async (updates: { enabled?: boolean; ignoredChannels?: string[] }) => {
    try {
      setSaving(true);
      setMutationError(null);
      const result = await loggingService.updateConfig(guildId, updates);
      await mutate(
        (current) =>
          current
          ? {
              ...current,
              enabled: result.enabled,
              ignoredChannels: result.ignoredChannels,
            }
          : current,
        { revalidate: false },
      );
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update logging config';
      setMutationError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const setIgnoredChannels = async (channelIds: string[]) => {
    try {
      setSaving(true);
      setMutationError(null);
      const result = await loggingService.setIgnoredChannels(guildId, channelIds);
      await mutate(
        (current) =>
          current
          ? {
              ...current,
              ignoredChannels: result.ignoredChannels,
            }
          : current,
        { revalidate: false },
      );
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update ignored channels';
      setMutationError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const addIgnoredChannel = async (channelId: string) => {
    try {
      setSaving(true);
      setMutationError(null);
      const result = await loggingService.addIgnoredChannel(guildId, channelId);
      await mutate(
        (current) =>
          current
          ? {
              ...current,
              ignoredChannels: result.ignoredChannels,
            }
          : current,
        { revalidate: false },
      );
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add ignored channel';
      setMutationError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const removeIgnoredChannel = async (channelId: string) => {
    try {
      setSaving(true);
      setMutationError(null);
      const result = await loggingService.removeIgnoredChannel(guildId, channelId);
      await mutate(
        (current) =>
          current
          ? {
              ...current,
              ignoredChannels: result.ignoredChannels,
            }
          : current,
        { revalidate: false },
      );
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove ignored channel';
      setMutationError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  return {
    config: config ?? null,
    loading: isLoading,
    saving,
    error:
      mutationError ??
      (error instanceof Error ? error.message : error ? 'Failed to fetch logging config' : null),
    updateConfig,
    setIgnoredChannels,
    addIgnoredChannel,
    removeIgnoredChannel,
    refetch: () => mutate(),
    setConfig: (value: LogConfig) => mutate(value, { revalidate: false }),
  };
}
