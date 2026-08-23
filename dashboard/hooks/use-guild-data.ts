'use client';

import { useState, useEffect } from 'react';
import { guildService } from '@/lib/services/guild.service';
import type { Channel, Role } from '@/lib/types';

export function useGuildData(guildId: string) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await guildService.getChannelsAndRoles(guildId);
        if (mounted) {
          setChannels(data.channels || []);
          setRoles(data.roles || []);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch guild data');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [guildId]);

  const voiceChannels = channels.filter(
    (c) => c.type === 'voice' || c.type === 'stage'
  );
  const textChannels = channels.filter((c) => c.type === 'text');

  return {
    channels,
    roles,
    voiceChannels,
    textChannels,
    loading,
    error,
  };
}
