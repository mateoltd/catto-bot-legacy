'use client';

import { useState, useEffect } from 'react';
import { voiceXPService, type VoiceXPConfig } from '@/lib/services/voice-xp.service';

export function useVoiceXPConfig(guildId: string) {
  const [config, setConfig] = useState<VoiceXPConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await voiceXPService.getConfig(guildId);
        if (mounted) {
          setConfig(data);
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

  const updateConfig = async (updates: Partial<VoiceXPConfig>) => {
    try {
      setError(null);
      const updated = await voiceXPService.updateConfig(guildId, updates);
      setConfig(updated);
      return { success: true, data: updated };
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
      voiceXPService
        .getConfig(guildId)
        .then((data) => setConfig(data))
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to fetch config'))
        .finally(() => setLoading(false));
    },
  };
}
