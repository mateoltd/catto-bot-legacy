'use client';

import { useState, useEffect, useRef } from 'react';
import { IconSettings } from '@/lib/mod-icons';
import { useUserMe } from '@/hooks/use-user-me';

interface AccountSwitcherProps {
  variant?: 'sidebar' | 'inline';
}

export function AccountSwitcher({ variant = 'sidebar' }: AccountSwitcherProps) {
  const userMe = useUserMe();
  const user = userMe?.user ?? null;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    fetch('/api/oauth/logout', { method: 'POST' })
      .then(() => {
        window.location.href = '/mod/login';
      })
      .catch(() => {
        window.location.href = '/mod/login';
      });
  };

  const handleSwitch = () => {
    document.cookie = `mod_auth_redirect=/mod; path=/; max-age=300; SameSite=Lax`;
    window.open('/api/oauth/login', 'auth', 'width=500,height=700');
  };

  const isInline = variant === 'inline';

  if (!user) {
    return (
      <div
        className={`flex items-center gap-2 ${
          isInline ? 'p-2' : 'border-t border-[var(--mod-border)] p-3'
        }`}
      >
        <div className="h-7 w-7 shrink-0 animate-pulse bg-[var(--mono-800)]" />
        <div className="h-3 w-20 animate-pulse bg-[var(--mono-800)]" />
      </div>
    );
  }

  const displayName = user.global_name || user.username;
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
    : null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center gap-2 text-left transition-[background-color] duration-75 hover:bg-[var(--mono-850)] ${
          isInline ? 'p-2' : 'border-t border-[var(--mod-border)] p-3'
        }`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-7 w-7 shrink-0" />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-[var(--mono-700)] text-xs text-[var(--mono-white)]">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="min-w-0 flex-1 truncate text-xs text-[var(--mono-white)]">{displayName}</span>
        <IconSettings size={14} className="shrink-0 text-[var(--mod-text-dim)]" />
      </button>

      {open && (
        <div className={`absolute left-0 z-50 mb-1 w-full border border-[var(--mod-border)] bg-[var(--mono-900)] shadow-lg ${
          isInline ? 'top-full mt-1' : 'bottom-full'
        }`}>
          <button
            onClick={handleSwitch}
            className="w-full px-3 py-2 text-left text-xs text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mono-850)]"
          >
            Switch Account
          </button>
          <button
            onClick={handleLogout}
            className="w-full border-t border-[var(--mod-border)] px-3 py-2 text-left text-xs text-red-400 transition-[background-color] duration-75 hover:bg-[var(--mono-850)]"
          >
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}
