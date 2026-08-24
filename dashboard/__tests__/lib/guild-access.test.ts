import { describe, expect, it } from 'vitest';
import { canManageGuild } from '@/lib/guild-access';

describe('canManageGuild', () => {
  it('allows server owners regardless of the permissions payload', () => {
    expect(canManageGuild({ owner: true, permissions: 'invalid' })).toBe(true);
  });

  it('allows members with the Discord Manage Guild bit', () => {
    expect(canManageGuild({ owner: false, permissions: '32' })).toBe(true);
  });

  it('rejects members without the Discord Manage Guild bit', () => {
    expect(canManageGuild({ owner: false, permissions: '8' })).toBe(false);
  });

  it('fails closed for malformed permission values', () => {
    expect(canManageGuild({ owner: false, permissions: 'not-a-bitfield' })).toBe(false);
  });
});
