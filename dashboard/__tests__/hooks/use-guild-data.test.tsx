import type { PropsWithChildren } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getChannelsAndRoles } = vi.hoisted(() => ({
  getChannelsAndRoles: vi.fn(),
}));

vi.mock('@/lib/services/guild.service', () => ({
  guildService: { getChannelsAndRoles },
}));

import { useGuildData } from '@/hooks/use-guild-data';

describe('useGuildData', () => {
  beforeEach(() => {
    getChannelsAndRoles.mockReset();
  });

  it('renders cached guild data immediately after the consumer remounts', async () => {
    const cache = new Map();
    const wrapper = ({ children }: PropsWithChildren) => (
      <SWRConfig value={{ provider: () => cache, dedupingInterval: 60_000 }}>
        {children}
      </SWRConfig>
    );
    getChannelsAndRoles.mockResolvedValue({
      channels: [{ id: 'channel-1', name: 'general', type: 'text' }],
      roles: [{ id: 'role-1', name: 'Member', color: 0, position: 1 }],
    });

    const first = renderHook(() => useGuildData('guild-1'), { wrapper });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();

    const second = renderHook(() => useGuildData('guild-1'), { wrapper });
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.textChannels).toHaveLength(1);
    expect(second.result.current.roles).toHaveLength(1);
  });
});
