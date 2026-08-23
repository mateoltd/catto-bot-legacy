import { getUserSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { Guild, User } from '@/lib/types';

interface GuildPageData {
  guild: Guild;
  user: User;
  token: string;
}

export async function getGuildPageData(guildId: string): Promise<GuildPageData> {
  const session = await getUserSession();

  if (!session) {
    redirect('/');
  }

  const { user, guilds } = session;
  const guild = guilds.find((g: Guild) => g.id === guildId);

  if (!guild) {
    redirect('/guilds');
  }

  const hasManageGuild = (BigInt(guild.permissions) & BigInt(0x20)) !== BigInt(0);
  const canManage = guild.owner || hasManageGuild;

  if (!canManage) {
    redirect('/guilds');
  }

  // Get auth token from cookies
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const token = cookieStore.get('DASHBOARD_AUTH')?.value;

  if (!token) {
    redirect('/');
  }

  return { guild, user, token };
}
