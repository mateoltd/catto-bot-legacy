import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';

const { updateConfig, startCleanup, getCleanup, getLatestCleanup } = vi.hoisted(() => ({
  updateConfig: vi.fn(),
  startCleanup: vi.fn(),
  getCleanup: vi.fn(),
  getLatestCleanup: vi.fn(),
}));

vi.mock('@/hooks/use-guild-data', () => ({
  useGuildData: () => ({
    roles: [
      {
        id: '111111111111111111',
        name: 'Supporter',
        color: 0,
        position: 1,
        editable: true,
        managed: false,
      },
    ],
    textChannels: [{ id: '222222222222222222', name: 'thanks', type: 'text', canSend: true }],
    loading: false,
  }),
}));

vi.mock('@/lib/services/vanity.service', () => ({
  vanityService: { updateConfig, startCleanup, getCleanup, getLatestCleanup },
}));

import VanityConfigForm from '@/components/vanity-config-form';

const initialConfig = {
  enabled: true,
  keyword: '/galaxia',
  roleId: '111111111111111111',
  thankYouEnabled: true,
  thankYouChannelId: '222222222222222222',
  thankYouMessage: 'Thanks {user}, you received {role} for {keyword}.',
};

function renderForm(onSaved = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="en-US" messages={messages} timeZone="UTC">
      <VanityConfigForm guildId="guild-1" initialConfig={initialConfig} onSaved={onSaved} />
    </NextIntlClientProvider>,
  );
}

describe('VanityConfigForm', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    getLatestCleanup.mockResolvedValue({ cleanup: null });
    updateConfig.mockImplementation(async (_guildId, config) => ({ config }));
    startCleanup.mockResolvedValue({ jobId: 'cleanup-1' });
    getCleanup.mockResolvedValue({
      cleanup: {
        id: 'cleanup-1',
        guildId: 'guild-1',
        roleId: initialConfig.roleId,
        state: 'waiting',
        processed: 0,
        removed: 0,
        failed: 0,
        total: 100,
        failureReason: null,
      },
    });
  });

  it('renders the live-message preview and saves a full replacement after edits', async () => {
    const onSaved = vi.fn();
    renderForm(onSaved);

    expect(
      screen.getByText('Thanks @member, you received @role for /galaxia.'),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Status phrase'), {
      target: { value: '/new-space' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateConfig).toHaveBeenCalledWith(
        'guild-1',
        expect.objectContaining({
          keyword: '/new-space',
          roleId: initialConfig.roleId,
        }),
      ),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('requires explicit confirmation before starting destructive cleanup', async () => {
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Disable and remove role' }));
    expect(screen.getByText('Remove this role from every member?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Disable and remove' }));

    await waitFor(() => expect(startCleanup).toHaveBeenCalledWith('guild-1'));
    await waitFor(() => expect(screen.getByText('Cleanup queued')).toBeInTheDocument());
  });
});
