import { describe, expect, it, vi } from 'vitest';

const { getUserSession, redirect } = vi.hoisted(() => ({
  getUserSession: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/lib/auth', () => ({ getUserSession }));
vi.mock('next/navigation', () => ({ redirect }));

import ProtectedModerationLayout from '@/app/mod/(protected)/layout';

describe('protected moderation layout', () => {
  it('redirects anonymous requests to the moderation login', async () => {
    getUserSession.mockResolvedValue(null);

    await expect(
      ProtectedModerationLayout({ children: <div>Protected</div> }),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/mod/login');
  });

  it('renders protected routes for an authenticated session', async () => {
    getUserSession.mockResolvedValue({ user: { id: 'user-1' }, guilds: [] });
    const children = <div>Protected</div>;

    await expect(ProtectedModerationLayout({ children })).resolves.toBe(children);
  });
});
