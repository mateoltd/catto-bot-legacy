'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { loggingService, type LogConfig } from '@/lib/services/logging.service';

export function useLoggingConfig(guildId: string) {
  const [config, setConfig] = useState<LogConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await loggingService.getConfig(guildId);
      if (mountedRef.current) {
        setConfig(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch logging config');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [guildId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchConfig();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchConfig]);

  const updateConfig = async (updates: { enabled?: boolean; ignoredChannels?: string[] }) => {
    try {
      setSaving(true);
      setError(null);
      const result = await loggingService.updateConfig(guildId, updates);
      // Update local state
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              enabled: result.enabled,
              ignoredChannels: result.ignoredChannels,
            }
          : null
      );
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update logging config';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const setIgnoredChannels = async (channelIds: string[]) => {
    try {
      setSaving(true);
      setError(null);
      const result = await loggingService.setIgnoredChannels(guildId, channelIds);
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              ignoredChannels: result.ignoredChannels,
            }
          : null
      );
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update ignored channels';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const addIgnoredChannel = async (channelId: string) => {
    try {
      setSaving(true);
      setError(null);
      const result = await loggingService.addIgnoredChannel(guildId, channelId);
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              ignoredChannels: result.ignoredChannels,
            }
          : null
      );
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add ignored channel';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  const removeIgnoredChannel = async (channelId: string) => {
    try {
      setSaving(true);
      setError(null);
      const result = await loggingService.removeIgnoredChannel(guildId, channelId);
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              ignoredChannels: result.ignoredChannels,
            }
          : null
      );
      return { success: true, data: result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove ignored channel';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSaving(false);
    }
  };

  return {
    config,
    loading,
    saving,
    error,
    updateConfig,
    setIgnoredChannels,
    addIgnoredChannel,
    removeIgnoredChannel,
    refetch: fetchConfig,
    setConfig,
  };
}
