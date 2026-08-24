import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import GuildPageLayout from '@/components/guild-page-layout';
import messages from '@/messages/en-US.json';

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/guilds/guild-1/xp',
  useRouter: () => ({ replace }),
}));

vi.mock('@/components/dashboard/account-menu', () => ({
  AccountMenu: () => null,
}));

vi.mock('@/components/dashboard/dashboard-topbar', () => ({
  DashboardTopbar: () => <header data-testid="dashboard-topbar" />,
}));

vi.mock('@/components/dashboard/guild-navigation-link', () => ({
  GuildNavigationLink: ({ item }: { item: { href: string; label: string } }) => (
    <a href={item.href}>{item.label}</a>
  ),
}));

vi.mock('@/components/dashboard/guild-sidebar', () => ({
  GuildSidebar: ({ onNavigate }: { onNavigate?: () => void }) => (
    <div>
      Guild sidebar
      {onNavigate && (
        <button type="button" onClick={onNavigate}>
          Navigate
        </button>
      )}
    </div>
  ),
}));

vi.mock('@/components/user-dropdown', () => ({
  UserDropdown: () => <div>User dropdown</div>,
}));

describe('GuildPageLayout', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps document overflow inside the dashboard content pane', () => {
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    const { unmount } = render(
      <NextIntlClientProvider locale="en-US" messages={messages}>
        <GuildPageLayout
          guild={{ id: 'guild-1', name: 'Test server', icon: null, owner: true, permissions: '0' }}
          user={{ id: 'user-1', username: 'tester', discriminator: '0', avatar: null }}
          access={{ canConfigure: true, canModerate: true }}
        >
          <div>Configuration content</div>
        </GuildPageLayout>
      </NextIntlClientProvider>,
    );

    const main = screen.getByRole('main');
    const grid = main.parentElement;
    const shell = grid?.parentElement;
    const aside = grid?.querySelector('aside');

    expect(shell).toHaveClass('flex', 'h-dvh', 'flex-col', 'overflow-hidden');
    expect(screen.getByTestId('dashboard-topbar').parentElement).toHaveClass('shrink-0');
    expect(grid).toHaveClass('min-h-0', 'flex-1');
    expect(aside).toHaveClass('min-h-0');
    expect(main).toHaveClass('min-h-0', 'min-w-0', 'overflow-y-auto');
    expect(main).toHaveTextContent('Configuration content');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.documentElement.style.overflow).toBe(htmlOverflow);
    expect(document.body.style.overflow).toBe(bodyOverflow);
  });

  it('opens grouped navigation in a mobile drawer instead of rendering a horizontal nav', async () => {
    const user = userEvent.setup();

    render(
      <NextIntlClientProvider locale="en-US" messages={messages}>
        <GuildPageLayout
          guild={{
            id: 'guild-1',
            name: 'Test server',
            icon: null,
            owner: true,
            permissions: '0',
          }}
          user={{
            id: 'user-1',
            username: 'tester',
            discriminator: '0',
            avatar: null,
          }}
          access={{ canConfigure: true, canModerate: true }}
        >
          <div>Configuration content</div>
        </GuildPageLayout>
      </NextIntlClientProvider>,
    );

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open server navigation' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Guild sidebar')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Navigate' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
