import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuildOverview } from '@/components/dashboard/guild-overview';

const { dashboardContext, mockUseSWR } = vi.hoisted(() => ({
  dashboardContext: {
    guild: {
      id: 'guild-1',
      name: 'Test server',
      icon: null,
      owner: true,
      permissions: '0',
    },
    user: {
      id: 'user-1',
      username: 'tester',
      discriminator: '0',
      avatar: null,
    },
    access: { canConfigure: true, canModerate: true },
  },
  mockUseSWR: vi.fn(),
}));

vi.mock('swr', () => ({ default: mockUseSWR }));
vi.mock('@/components/guild-page-layout', () => ({
  useGuildDashboard: () => dashboardContext,
}));

describe('GuildOverview', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    dashboardContext.access.canConfigure = true;
    dashboardContext.access.canModerate = true;
  });

  it('prioritizes live server context without repeating module navigation', () => {
    mockUseSWR.mockReturnValue({
      data: {
        memberCount: 888,
        channelCount: 23,
        roleCount: 17,
        databaseUsers: 222,
        joinedAt: '2026-01-10T00:00:00.000Z',
      },
      error: undefined,
      isLoading: false,
    });

    render(<GuildOverview guildId="guild-1" />);

    expect(screen.getByRole('heading', { name: 'Test server' })).toBeInTheDocument();
    expect(screen.getByText('888')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Tracked members' })).toHaveAttribute(
      'aria-valuenow',
      '222',
    );
    expect(screen.queryByText('Text XP')).not.toBeInTheDocument();
    expect(screen.queryByText('Voice XP')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open moderation/i })).toHaveAttribute(
      'href',
      '/mod/guild-1',
    );
  });

  it('does not show the moderation action without moderation access', () => {
    dashboardContext.access.canModerate = false;
    mockUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: true });

    render(<GuildOverview guildId="guild-1" />);

    expect(screen.queryByRole('link', { name: /open moderation/i })).not.toBeInTheDocument();
  });
});
