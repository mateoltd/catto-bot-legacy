'use client';

import { AccountMenu } from '@/components/dashboard/account-menu';
import { useUserMe } from '@/hooks/use-user-me';

export function AccountSwitcher({ variant = 'sidebar' }: { variant?: 'sidebar' | 'inline' }) {
  const user = useUserMe()?.user;

  if (!user) {
    return (
      <div
        className={`flex items-center gap-2 ${
          variant === 'sidebar' ? 'border-t border-border p-3' : 'p-2'
        }`}
      >
        <div className="h-7 w-7 animate-pulse bg-muted" />
        <div className="h-3 w-20 animate-pulse bg-muted" />
      </div>
    );
  }

  return (
    <AccountMenu
      user={{ ...user, displayName: user.global_name }}
      variant={variant}
      logoutDestination="/mod/login"
      allowAccountSwitch
    />
  );
}
