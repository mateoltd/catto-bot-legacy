import { redirect } from 'next/navigation';
import { getUserSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ProtectedModerationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await getUserSession())) redirect('/mod/login');

  return children;
}
