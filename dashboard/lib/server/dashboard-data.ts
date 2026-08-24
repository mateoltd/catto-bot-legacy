import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserSession } from '@/lib/auth';
import { canManageGuild } from '@/lib/guild-access';
import { botApiUrl } from '@/lib/server/bot-api';
import type { Guild, UserSession } from '@/lib/types';

interface BotGuild {
  id: string;
}

export interface DashboardGuild extends Guild {
  botInstalled: boolean;
}

export interface DashboardSession extends Omit<UserSession, 'guilds'> {
  guilds: DashboardGuild[];
  isBotApiAvailable: boolean;
}

export interface GuildStats {
  memberCount: number;
  channelCount: number;
  roleCount: number;
  databaseUsers: number;
  joinedAt: string | null;
}

async function getAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('DASHBOARD_AUTH')?.value ?? null;
}

async function requestBotApi(path: string, authCookie: string): Promise<Response | null> {
  try {
    return await fetch(botApiUrl(path), {
      headers: { Cookie: `DASHBOARD_AUTH=${authCookie}` },
      cache: 'no-store',
    });
  } catch {
    return null;
  }
}

async function getBotGuildIds(authCookie: string): Promise<Set<string> | null> {
  const response = await requestBotApi('/api/guilds', authCookie);
  if (!response?.ok) return null;

  const payload = (await response.json()) as { guilds?: BotGuild[] };
  return new Set((payload.guilds ?? []).map((guild) => guild.id));
}

export async function getDashboardSession(): Promise<DashboardSession | null> {
  const [session, authCookie] = await Promise.all([getUserSession(), getAuthCookie()]);
  if (!session || !authCookie) return null;

  const botGuildIds = await getBotGuildIds(authCookie);
  if (!botGuildIds) {
    return {
      ...session,
      guilds: session.guilds.map((guild) => ({ ...guild, botInstalled: false })),
      isBotApiAvailable: false,
    };
  }

  return {
    ...session,
    guilds: session.guilds.map((guild) => ({
      ...guild,
      botInstalled: botGuildIds.has(guild.id),
    })),
    isBotApiAvailable: true,
  };
}

export async function getModerationDashboardSession(): Promise<UserSession | null> {
  const [session, authCookie] = await Promise.all([getUserSession(), getAuthCookie()]);
  if (!session || !authCookie) return null;
  if (session.guilds.length === 0) return session;

  const accessResponse = await (async () => {
    try {
      return await fetch(botApiUrl('/api/guilds/accessible'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `DASHBOARD_AUTH=${authCookie}`,
        },
        body: JSON.stringify({ guildIds: session.guilds.map((guild) => guild.id) }),
        cache: 'no-store',
      });
    } catch {
      return null;
    }
  })();

  if (accessResponse?.ok) {
    const payload = (await accessResponse.json()) as { guildIds?: string[] };
    const accessibleGuildIds = new Set(payload.guildIds ?? []);
    return {
      ...session,
      guilds: session.guilds.filter((guild) => accessibleGuildIds.has(guild.id)),
    };
  }

  const botGuildIds = await getBotGuildIds(authCookie);
  return botGuildIds
    ? { ...session, guilds: session.guilds.filter((guild) => botGuildIds.has(guild.id)) }
    : session;
}

export async function getGuildStats(guildId: string, authCookie: string): Promise<GuildStats | null> {
  const response = await requestBotApi(`/api/guilds/${guildId}/stats`, authCookie);
  if (!response?.ok) return null;

  const payload = (await response.json()) as { stats?: GuildStats };
  return payload.stats ?? null;
}

export async function requireGuildPageData(guildId: string) {
  const [session, authCookie] = await Promise.all([getUserSession(), getAuthCookie()]);
  if (!session || !authCookie) redirect('/');

  const guild = session.guilds.find((entry) => entry.id === guildId);
  if (!guild || !canManageGuild(guild)) redirect('/guilds');

  const response = await requestBotApi(`/api/guilds/${guildId}`, authCookie);
  if (response?.status === 401) redirect('/');
  if (!response?.ok) redirect('/guilds?notice=unavailable');

  return { guild, user: session.user, authCookie };
}
