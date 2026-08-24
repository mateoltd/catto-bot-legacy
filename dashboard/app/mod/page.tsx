export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { ServerPicker } from '@/components/mod/server-picker';
import { getModerationDashboardSession } from '@/lib/server';

export default async function ModDashboardHome() {
  const session = await getModerationDashboardSession();
  if (!session) redirect('/mod/login');

  return <ServerPicker session={session} />;
}
