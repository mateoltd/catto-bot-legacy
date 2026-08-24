'use client';

import useSWR from 'swr';
import { guildService } from '@/lib/services/guild.service';

export function useGuildData(guildId: string) {
  const { data, error, isLoading } = useSWR(
    ['guild-channels-roles', guildId],
    () => guildService.getChannelsAndRoles(guildId),
    { revalidateOnFocus: false },
  );
  const channels = data?.channels ?? [];
  const roles = data?.roles ?? [];
  const voiceChannels = channels.filter(
    (channel) => channel.type === 'voice' || channel.type === 'stage',
  );
  const textChannels = channels.filter((channel) => channel.type === 'text');

  return {
    channels,
    roles,
    voiceChannels,
    textChannels,
    loading: isLoading,
    error: error instanceof Error ? error.message : error ? 'Failed to fetch guild data' : null,
  };
}
