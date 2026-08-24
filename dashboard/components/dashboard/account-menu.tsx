'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  IconArrowsExchange,
  IconChevronDown,
  IconLogout,
} from '@tabler/icons-react';

export interface AccountIdentity {
  id: string;
  username: string;
  avatar: string | null;
  displayName?: string | null;
}

interface AccountMenuProps {
  user: AccountIdentity;
  variant?: 'header' | 'sidebar' | 'inline';
  logoutDestination?: string;
  allowAccountSwitch?: boolean;
}

export function AccountMenu({
  user,
  variant = 'header',
  logoutDestination = '/',
  allowAccountSwitch = false,
}: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const displayName = user.displayName || user.username;
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=96`
    : null;
  const isSidebar = variant === 'sidebar';

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const logout = async () => {
    await fetch('/api/oauth/logout', { method: 'POST', credentials: 'include' }).catch(() => null);
    router.replace(logoutDestination);
    router.refresh();
  };

  const switchAccount = () => {
    document.cookie = 'mod_auth_redirect=/guilds; path=/; max-age=300; SameSite=Lax';
    window.open('/api/oauth/login?prompt=consent', '_self');
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex w-full items-center gap-2 border-border bg-card text-left hover:bg-accent ${
          isSidebar ? 'border-t px-3 py-3' : 'border px-2 py-1.5'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-muted font-mono text-xs text-foreground">
            {displayName.charAt(0).toLocaleUpperCase()}
          </span>
        )}
        <span
          className={`min-w-0 flex-1 truncate text-xs text-foreground ${
            variant === 'header' ? 'hidden max-w-36 sm:block' : ''
          }`}
        >
          {displayName}
        </span>
        <IconChevronDown
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 w-60 border border-border bg-popover shadow-xl ${
            isSidebar ? 'bottom-full left-0 mb-1' : 'right-0 top-full mt-1'
          }`}
          role="menu"
        >
          <div className="border-b border-border px-3 py-3">
            <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
            <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{user.id}</p>
          </div>
          <div className="p-1">
            {allowAccountSwitch && (
              <button
                type="button"
                role="menuitem"
                onClick={switchAccount}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <IconArrowsExchange size={15} />
                Switch account
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10"
            >
              <IconLogout size={15} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
