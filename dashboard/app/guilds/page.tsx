export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { BrandMark } from '@/components/dashboard/brand-mark';
import { ServerDirectory } from '@/components/dashboard/server-directory';
import { UserDropdown } from '@/components/user-dropdown';
import { getDashboardSession } from '@/lib/server';

interface GuildsPageProps {
  searchParams: Promise<{ notice?: string }>;
}

export default async function GuildsPage({ searchParams }: GuildsPageProps) {
  const [session, query] = await Promise.all([getDashboardSession(), searchParams]);
  if (!session) redirect('/');

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <BrandMark compact />
          <UserDropdown user={session.user} />
        </div>
      </header>
      <ServerDirectory
        guilds={session.guilds}
        isBotApiAvailable={session.isBotApiAvailable}
        notice={query.notice}
      />
    </main>
  );
}
