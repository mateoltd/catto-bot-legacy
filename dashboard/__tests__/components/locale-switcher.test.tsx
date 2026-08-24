import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleSwitcher } from '@/components/dashboard/locale-switcher';
import messages from '@/messages/en-US.json';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('persists the selected locale and refreshes the current route', async () => {
    render(
      <NextIntlClientProvider locale="en-US" messages={messages} timeZone="UTC">
        <LocaleSwitcher />
      </NextIntlClientProvider>,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Change dashboard language' }), {
      target: { value: 'fr-FR' },
    });

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith('/api/locale', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'fr-FR' }),
    });
  });
});
