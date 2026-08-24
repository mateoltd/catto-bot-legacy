import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { MultiSelectList } from '@/components/ui/multi-select-list';
import { ChannelFilterList } from '@/components/ui/channel-filter-list';
import { OptionSelector } from '@/components/ui/option-selector';
import { UnsavedChangesBar } from '@/components/ui/unsaved-changes-bar';
import messages from '@/messages/en-US.json';

function Intl({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en-US" messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

describe('configuration controls', () => {
  it('changes the selected option and exposes radio state', () => {
    function Example() {
      const [value, setValue] = useState<'formula' | 'table'>('formula');
      return (
        <OptionSelector
          value={value}
          onValueChange={setValue}
          options={[
            { value: 'formula', label: 'Formula' },
            { value: 'table', label: 'Table' },
          ]}
        />
      );
    }

    render(<Intl><Example /></Intl>);
    fireEvent.click(screen.getByRole('radio', { name: 'Table' }));

    expect(screen.getByRole('radio', { name: 'Table' })).toHaveAttribute('aria-checked', 'true');
  });

  it('filters and clears multi-select values', () => {
    function Example() {
      const [value, setValue] = useState<string[]>(['1']);
      return (
        <MultiSelectList
          value={value}
          onValueChange={setValue}
          items={Array.from({ length: 7 }, (_, index) => ({
            value: String(index + 1),
            label: `Channel ${index + 1}`,
          }))}
          searchPlaceholder="Filter channels"
        />
      );
    }

    render(<Intl><Example /></Intl>);
    fireEvent.change(screen.getByLabelText('Filter channels'), { target: { value: 'Channel 7' } });

    expect(screen.queryByText('Channel 1')).not.toBeInTheDocument();
    expect(screen.getByText('Channel 7')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('None selected')).toBeInTheDocument();
  });

  it('keeps allow and ignore policies mutually exclusive', () => {
    function Example() {
      const [allowed, setAllowed] = useState<string[]>(['general']);
      const [ignored, setIgnored] = useState<string[]>([]);
      return (
        <ChannelFilterList
          items={[{ value: 'general', label: 'General policy test' }]}
          allowed={allowed}
          ignored={ignored}
          onAllowedChange={setAllowed}
          onIgnoredChange={setIgnored}
        />
      );
    }

    render(<Intl><Example /></Intl>);
    const policy = within(screen.getByRole('group', { name: 'Policy for General policy test' }));
    expect(policy.getByRole('button', { name: 'Allow' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(policy.getByRole('button', { name: 'Ignore' }));

    expect(policy.getByRole('button', { name: 'Allow' })).toHaveAttribute('aria-pressed', 'false');
    expect(policy.getByRole('button', { name: 'Ignore' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('only renders the save action for dirty state', () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <Intl><UnsavedChangesBar visible={false} onSave={onSave} /></Intl>
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    rerender(<Intl><UnsavedChangesBar visible onSave={onSave} /></Intl>);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledOnce();
  });
});
