import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  RewardBuilder,
  type RewardFormState,
} from '@/components/rewards/reward-builder';
import messages from '@/messages/en-US.json';

const initialReward: RewardFormState = {
  level: 1,
  xpType: 'TEXT',
  rewardType: 'ROLE_ADD',
  roleId: '',
  removeRoleIds: [],
  channelIds: [],
  permissions: [],
  message: '',
  name: '',
  description: '',
  stackable: false,
  oneTime: true,
};

afterEach(cleanup);

function Example({ onSubmit = vi.fn() }: { onSubmit?: () => void }) {
  const [value, setValue] = useState(initialReward);
  return (
    <NextIntlClientProvider locale="en-US" messages={messages} timeZone="UTC">
      <RewardBuilder
        value={value}
        onChange={setValue}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        roles={[{ id: 'veteran', name: 'Veteran', color: 0xffaa00, position: 1 }]}
        textChannels={[{ id: 'lounge', name: 'lounge', type: 'text' }]}
      />
    </NextIntlClientProvider>
  );
}

describe('RewardBuilder', () => {
  it('guides role rewards and suggests a useful name', () => {
    const onSubmit = vi.fn();
    render(<Example onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: '10' }));
    fireEvent.click(screen.getByRole('radio', { name: /voice time/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByText('Veteran'));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByLabelText('Reward name')).toHaveValue('Veteran — Level 10');
    expect(screen.getByText('Level 10')).toBeInTheDocument();
    expect(screen.getByText('VOICE')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /create reward/i }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('keeps the user on the reward step until its target is configured', () => {
    render(<Example />);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Choose a role to continue.');
    expect(screen.queryByLabelText('Reward name')).not.toBeInTheDocument();
  });
});
