export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar';
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
      <DashboardTopbar
        contentClassName="lg:px-8"
        trailing={<UserDropdown user={session.user} />}
      />
      <ServerDirectory
        guilds={session.guilds}
        isBotApiAvailable={session.isBotApiAvailable}
        isModerationApiAvailable={session.isModerationApiAvailable}
        notice={query.notice}
      />
    </main>
  );
}
