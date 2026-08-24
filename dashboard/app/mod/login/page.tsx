import { IconShieldLock } from '@tabler/icons-react';
import { BrandMark } from '@/components/dashboard/brand-mark';
import { LoginButton } from '@/components/login-button';

export default function ModLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <BrandMark compact href="/" />
          <IconShieldLock size={18} className="text-muted-foreground" />
        </div>
        <div className="p-7 sm:p-9">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Restricted surface
          </p>
          <h1 className="mt-4 text-xl font-semibold text-foreground">Moderation dashboard</h1>
          <p className="mb-7 mt-2 text-sm leading-6 text-muted-foreground">
            Sign in with Discord. Access is granted from your server roles and Catto permission
            overrides.
          </p>
          <LoginButton redirectPath="/guilds" label="Authenticate with Discord" />
        </div>
      </div>
    </main>
  );
}
