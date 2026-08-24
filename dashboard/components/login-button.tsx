'use client';

import { useState } from 'react';
import { IconBrandDiscord } from '@tabler/icons-react';

interface LoginButtonProps {
  redirectPath?: string;
  label?: string;
}

export function LoginButton({
  redirectPath,
  label = 'Continue with Discord',
}: LoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <form
      action="/api/oauth/login"
      method="get"
      onSubmit={() => {
        setIsLoading(true);
        const hasRedirectCookie = document.cookie
          .split('; ')
          .some((cookie) => cookie.startsWith('mod_auth_redirect='));
        if (redirectPath && !hasRedirectCookie) {
          document.cookie = `mod_auth_redirect=${redirectPath}; path=/; max-age=300; SameSite=Lax`;
        }
      }}
    >
      <button
        type="submit"
        disabled={isLoading}
        className="flex h-12 w-full items-center justify-center gap-2 border border-muted-foreground bg-foreground px-5 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-background hover:bg-white disabled:bg-muted-foreground"
      >
        <IconBrandDiscord size={19} />
        {isLoading ? 'Connecting…' : label}
      </button>
    </form>
  );
}
