import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; expires?: string }>;
}) {
  const { token, expires } = await searchParams;

  if (!token) {
    redirect('/');
  }

  // Set the auth cookie on the dashboard domain
  const cookieStore = await cookies();
  cookieStore.set('SAPPHIRE_AUTH', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: expires ? parseInt(expires) : 604800, // Default 7 days
  });

  // Redirect to guilds page
  redirect('/guilds');
}
