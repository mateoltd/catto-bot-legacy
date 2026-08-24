'use client';

import { useState } from 'react';
import { IconBrandDiscord } from '@/lib/mod-icons';

export default function ModLoginPage() {
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    // Only set the redirect cookie if one isn't already set by the middleware
    const existing = document.cookie.split('; ').find(c => c.startsWith('mod_auth_redirect='));
    if (!existing) {
      document.cookie = `mod_auth_redirect=/mod; path=/; max-age=300; SameSite=Lax`;
    }
    window.location.href = '/api/oauth/login';
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">

        <div className="border border-[var(--mod-border)] bg-[var(--mod-surface)] p-8">
          {/* Section label */}
          <p
            className="mb-4 text-xs uppercase tracking-[0.25em] text-[var(--mod-text-dim)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            AUTHENTICATE
          </p>

          <h1
            className="mb-2 text-xl font-bold text-[var(--mono-white)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Mod Dashboard
          </h1>
          <p className="mb-8 text-sm text-[var(--mod-text-dim)]" style={{ fontFamily: 'var(--font-mono)' }}>
            Authenticate to access moderation tools
          </p>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 border border-[var(--mono-500)] px-4 py-3 text-sm font-medium text-[var(--mono-white)] transition-[background-color] duration-75 hover:bg-[var(--mono-800)] disabled:opacity-50"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            <IconBrandDiscord size={20} />
            {loading ? (
              'Redirecting...'
            ) : (
              <>
                Authenticate with Discord
              </>
            )}
          </button>

          <p className="mt-4 text-center text-xs text-[var(--mod-text-dim)]" style={{ fontFamily: 'var(--font-mono)' }}>
            Only users with moderation permissions will be granted access.
          </p>
        </div>

      </div>
    </div>
  );
}
