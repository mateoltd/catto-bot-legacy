'use client';

import { useSyncExternalStore } from 'react';
import { onSessionExpired } from '@/lib/auth-events';
import { IconAlertTriangle } from '@/lib/mod-icons';

const BOT_API_URL = process.env.NEXT_PUBLIC_BOT_API_URL || 'http://localhost:4000';

// External store for session expired state
let sessionExpired = false;
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);

  // Subscribe to the auth event and update store
  const unsubscribe = onSessionExpired(() => {
    if (!sessionExpired) {
      sessionExpired = true;
      listeners.forEach((listener) => listener());
    }
  });

  return () => {
    listeners.delete(callback);
    unsubscribe();
  };
}

function getSnapshot() {
  return sessionExpired;
}

function getServerSnapshot() {
  return false;
}

export function SessionExpiredModal() {
  const isExpired = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!isExpired) return null;

  const handleLogin = () => {
    // Save the current route so we return here after re-auth
    const currentPath = window.location.pathname + window.location.search;
    document.cookie = `mod_auth_redirect=${encodeURIComponent(currentPath)}; path=/; max-age=300; SameSite=Lax`;
    window.location.href = `${BOT_API_URL}/api/oauth/login`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-sm border bg-[var(--mod-surface)] p-6"
        style={{ borderColor: 'var(--mod-border)' }}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-amber-500/10">
            <IconAlertTriangle size={20} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--mono-white)]">Session Expired</h2>
            <p className="text-sm text-[var(--mod-text-muted)]">Please log in again to continue</p>
          </div>
        </div>

        <p className="mb-6 text-sm text-[var(--mod-text-muted)]">
          Your session has expired or is no longer valid. Click below to authenticate with Discord
          and resume your work.
        </p>

        <button
          onClick={handleLogin}
          className="w-full border border-[var(--mod-border)] bg-[var(--mono-800)] px-4 py-2.5 text-sm font-medium text-[var(--mono-white)] transition-colors hover:bg-[var(--mono-700)]"
        >
          Log in with Discord
        </button>
      </div>
    </div>
  );
}
