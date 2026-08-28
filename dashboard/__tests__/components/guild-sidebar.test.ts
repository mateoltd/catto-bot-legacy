import { describe, expect, it } from 'vitest';
import { getGuildNavigation } from '@/lib/guild-navigation';

function itemIds(canConfigure: boolean, canModerate: boolean) {
  return getGuildNavigation('guild-1', { canConfigure, canModerate }).flatMap((section) =>
    section.items.map((item) => item.id),
  );
}

describe('getGuildNavigation', () => {
  it('shows configuration without exposing moderation to server managers', () => {
    expect(itemIds(true, false)).toEqual([
      'overview',
      'text-xp',
      'voice-xp',
      'rewards',
      'temp-voice',
      'logs',
    ]);
  });

  it('shows moderation without exposing configuration to moderators', () => {
    expect(itemIds(false, true)).toEqual([
      'overview',
      'moderation',
      'cases',
      'evidence',
      'users',
      'analytics',
    ]);
  });

  it('combines both navigation groups for users with both capabilities', () => {
    const navigation = getGuildNavigation('guild-1', {
      canConfigure: true,
      canModerate: true,
    });

    expect(navigation.map((section) => section.label)).toEqual([
      'Server',
      'Configuration',
      'Moderation',
    ]);
  });
});
