import { ActivityType } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getVanityConfig } = vi.hoisted(() => ({
  getVanityConfig: vi.fn(),
}));

vi.mock('#modules/vanity/config.service.js', () => ({
  getVanityConfig,
}));

import {
  hasVanityKeyword,
  reconcileGuildVanity,
  syncVanityMember,
} from '#modules/vanity/runtime.service.js';

function activity(type: ActivityType, state: string | null) {
  return { type, state } as never;
}

function configured() {
  return {
    enabled: true,
    keyword: '/meetspace',
    roleId: '111111111111111111',
    thankYouEnabled: false,
    thankYouChannelId: null,
    thankYouMessage: '',
  };
}

function memberFixture(options: { id: string; state: string; hasRole?: boolean }) {
  const role = { id: '111111111111111111' };
  const roles = new Map<string, unknown>();
  if (options.hasRole) roles.set(role.id, role);
  const add = vi.fn();
  const remove = vi.fn();
  const guild = {
    id: '222222222222222222',
    roles: { cache: new Map([[role.id, role]]) },
  };
  const member = {
    id: options.id,
    user: { bot: false },
    guild,
    presence: {
      status: 'online',
      activities: [activity(ActivityType.Custom, options.state)],
    },
    roles: { cache: roles, add, remove },
  };
  return { member, guild, add, remove };
}

describe('vanity runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getVanityConfig.mockResolvedValue(configured());
  });

  it('matches only custom activity state using a case-insensitive substring', () => {
    expect(
      hasVanityKeyword(
        [
          activity(ActivityType.Playing, '/meetspace'),
          activity(ActivityType.Custom, 'JOIN /MeetSpace'),
        ],
        ' /meetspace ',
      ),
    ).toBe(true);
    expect(hasVanityKeyword([activity(ActivityType.Playing, '/meetspace')], '/meetspace')).toBe(
      false,
    );
    expect(hasVanityKeyword([activity(ActivityType.Custom, null)], '/meetspace')).toBe(false);
    expect(hasVanityKeyword([activity(ActivityType.Custom, '/meetspace')], '   ')).toBe(false);
  });

  it('adds, removes, or avoids the Discord API according to the observed mismatch', async () => {
    const addFixture = memberFixture({
      id: 'member-add',
      state: 'visit /meetspace',
    });
    const removeFixture = memberFixture({
      id: 'member-remove',
      state: 'hello',
      hasRole: true,
    });
    const unchangedFixture = memberFixture({
      id: 'member-unchanged',
      state: 'visit /meetspace',
      hasRole: true,
    });

    await expect(syncVanityMember(addFixture.member as never, 'reconcile')).resolves.toEqual({
      outcome: 'added',
    });
    await expect(syncVanityMember(removeFixture.member as never, 'reconcile')).resolves.toEqual({
      outcome: 'removed',
    });
    await expect(syncVanityMember(unchangedFixture.member as never, 'reconcile')).resolves.toEqual({
      outcome: 'unchanged',
    });

    expect(addFixture.add).toHaveBeenCalledOnce();
    expect(removeFixture.remove).toHaveBeenCalledOnce();
    expect(unchangedFixture.add).not.toHaveBeenCalled();
    expect(unchangedFixture.remove).not.toHaveBeenCalled();
  });

  it('reconciles only members represented by non-offline presences without fetching members', async () => {
    const online = memberFixture({ id: 'online-member', state: '/meetspace' });
    const offline = memberFixture({
      id: 'offline-member',
      state: '',
      hasRole: true,
    });
    const fetch = vi.fn();
    const guild = {
      ...online.guild,
      memberCount: 2,
      presences: {
        cache: new Map([
          [
            'online-member',
            {
              status: 'online',
              member: online.member,
              userId: 'online-member',
            },
          ],
        ]),
      },
      members: {
        cache: new Map([
          ['online-member', online.member],
          ['offline-member', offline.member],
        ]),
        fetch,
      },
    };

    await expect(reconcileGuildVanity(guild as never)).resolves.toEqual({
      checked: 1,
      changed: 1,
      failed: 0,
    });
    expect(online.add).toHaveBeenCalledOnce();
    expect(offline.remove).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
