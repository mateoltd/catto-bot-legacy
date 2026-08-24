import { redirect } from 'next/navigation';

export default function LegacyAuthCallbackPage() {
  // Raw OAuth tokens are no longer accepted by the dashboard.
  redirect('/');
}
