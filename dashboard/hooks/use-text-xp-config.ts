'use client';

import { useState, useEffect } from 'react';
import { textXPService, type XPConfig } from '@/lib/services/text-xp.service';

export function useTextXPConfig(guildId: string) {
  const [config, setConfig] = useState<XPConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await textXPService.getConfig(guildId);
        if (mounted) {
          setConfig(data.config);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch config');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchConfig();

    return () => {
      mounted = false;
    };
  }, [guildId]);

  const updateConfig = async (updates: Partial<XPConfig>) => {
    try {
      setError(null);
      const updated = await textXPService.updateConfig(guildId, updates);
      setConfig(updated.config);
      return { success: true, data: updated.config };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update config';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  return {
    config,
    loading,
    error,
    updateConfig,
    refetch: () => {
      setLoading(true);
      textXPService
        .getConfig(guildId)
        .then((data) => setConfig(data.config))
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to fetch config'))
        .finally(() => setLoading(false));
    },
  };
}
