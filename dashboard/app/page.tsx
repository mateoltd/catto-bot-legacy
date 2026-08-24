export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { BrandMark } from '@/components/dashboard/brand-mark';
import { LoginButton } from '@/components/login-button';
import { getCurrentUser } from '@/lib/auth';

export default async function Home() {
  if (await getCurrentUser()) redirect('/guilds');

  return (
    <main className="min-h-screen bg-background">
      <header className="absolute inset-x-0 top-0 z-10 flex h-16 items-center justify-between border-b border-border px-5 sm:px-7">
        <BrandMark href="/" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Dashboard
        </span>
      </header>

      <div className="grid min-h-screen pt-16 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
        <DashboardVisual />

        <section className="flex items-center border-t border-border bg-card p-7 sm:p-12 lg:border-l lg:border-t-0">
          <div className="w-full">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Authentication
            </p>
            <h1 className="mb-8 mt-3 text-2xl font-semibold text-foreground">Sign in</h1>
            <LoginButton />
          </div>
        </section>
      </div>
    </main>
  );
}

function DashboardVisual() {
  return (
    <section
      className="relative flex min-h-[55vh] items-center justify-center overflow-hidden bg-background px-6 py-16 lg:min-h-0"
      aria-label="Catto"
    >
      <div className="absolute inset-x-0 top-1/2 border-t border-border" />
      <div className="absolute inset-y-0 left-1/2 border-l border-border" />
      <div className="absolute left-6 top-6 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
        48.8566 N<br />2.3522 E
      </div>
      <div className="absolute bottom-6 right-6 text-right font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
        CATTO<br />2026
      </div>

      <div className="relative flex aspect-square w-[min(68vw,30rem)] items-center justify-center border border-border bg-card sm:w-[min(52vw,34rem)]">
        <div className="absolute inset-[12%] border border-border" />
        <div className="absolute inset-[24%] border border-border" />
        <span className="absolute left-[12%] top-[12%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-foreground" />
        <span className="absolute bottom-[24%] right-[24%] h-2 w-2 translate-x-1/2 translate-y-1/2 bg-foreground" />
        <pre className="relative z-[1] select-none font-mono text-[clamp(1.1rem,3.5vw,2.75rem)] leading-[1.15] text-foreground" aria-hidden="true">{` /\\_/\\
( o.o )
 > ^ <`}</pre>
      </div>
    </section>
  );
}
