import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

// ALL mock state must be hoisted since vi.mock factory runs before module initialization
const { mockOnSessionExpired, capturedCallback } = vi.hoisted(() => {
  const capturedCallback = { current: null as (() => void) | null };

  const mockOnSessionExpired = vi.fn((cb: () => void) => {
    capturedCallback.current = cb;
    return vi.fn(); // unsubscribe
  });

  return { mockOnSessionExpired, capturedCallback };
});

vi.mock('@/lib/auth-events', () => ({
  onSessionExpired: mockOnSessionExpired,
}));

vi.mock('@/lib/mod-icons', () => ({
  IconAlertTriangle: (props: any) => <span data-testid="alert-icon" {...props} />,
}));

describe('SessionExpiredModal', () => {
  // We use dynamic import + vi.resetModules() to reset the module-level
  // `sessionExpired` variable between tests
  let SessionExpiredModal: typeof import('@/components/mod/session-expired-modal').SessionExpiredModal;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    capturedCallback.current = null;

    // Re-import to get fresh module state (sessionExpired = false)
    const mod = await import('@/components/mod/session-expired-modal');
    SessionExpiredModal = mod.SessionExpiredModal;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('opens only after the session-expired event', () => {
    render(<SessionExpiredModal />);
    expect(screen.queryByText('Session Expired')).not.toBeInTheDocument();

    act(() => {
      capturedCallback.current?.();
    });

    expect(screen.getByText('Session Expired')).toBeInTheDocument();
  });

  it('preserves the current route and redirects to OAuth login', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/mod/guild-1/cases', search: '?page=2', href: '' },
      writable: true,
    });

    const cookieSpy = vi.spyOn(document, 'cookie', 'set');

    render(<SessionExpiredModal />);

    act(() => {
      capturedCallback.current?.();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Log in with Discord' }));

    const cookieWrite = cookieSpy.mock.calls[0][0];
    expect(cookieWrite).toContain('mod_auth_redirect=');
    expect(cookieWrite).toContain(encodeURIComponent('/mod/guild-1/cases?page=2'));
    expect(cookieWrite).toContain('max-age=300');
    expect(cookieWrite).toContain('SameSite=Lax');
    expect(window.location.href).toBe('/api/oauth/login');
  });
});
