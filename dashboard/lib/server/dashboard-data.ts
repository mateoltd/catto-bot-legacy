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
  canConfigure: boolean;
  canModerate: boolean;
}

export interface DashboardSession extends Omit<UserSession, 'guilds'> {
  guilds: DashboardGuild[];
  isBotApiAvailable: boolean;
  isModerationApiAvailable: boolean;
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

async function getModerationGuildIds(
  authCookie: string,
  guildIds: string[],
): Promise<Set<string> | null> {
  if (guildIds.length === 0) return new Set();

  try {
    const response = await fetch(botApiUrl('/api/guilds/accessible'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `DASHBOARD_AUTH=${authCookie}`,
      },
      body: JSON.stringify({ guildIds }),
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as { guildIds?: string[] };
    return new Set(payload.guildIds ?? []);
  } catch {
    return null;
  }
}

async function canModerateGuild(authCookie: string, guildId: string): Promise<boolean> {
  const response = await requestBotApi(
    `/api/guilds/${guildId}/moderation/dashboard-access`,
    authCookie,
  );
  if (!response?.ok) return false;

  const payload = (await response.json()) as { hasAccess?: boolean };
  return payload.hasAccess === true;
}

export async function getDashboardSession(): Promise<DashboardSession | null> {
  const [session, authCookie] = await Promise.all([getUserSession(), getAuthCookie()]);
  if (!session || !authCookie) return null;

  const guildIds = session.guilds.map((guild) => guild.id);
  const [botGuildIds, moderationGuildIds] = await Promise.all([
    getBotGuildIds(authCookie),
    getModerationGuildIds(authCookie, guildIds),
  ]);

  return {
    ...session,
    guilds: session.guilds.map((guild) => {
      const canModerate = moderationGuildIds?.has(guild.id) ?? false;
      const botInstalled = (botGuildIds?.has(guild.id) ?? false) || canModerate;

      return {
        ...guild,
        botInstalled,
        canConfigure: botInstalled && canManageGuild(guild),
        canModerate,
      };
    }),
    isBotApiAvailable: botGuildIds !== null,
    isModerationApiAvailable: moderationGuildIds !== null,
  };
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

  const [response, canModerate] = await Promise.all([
    requestBotApi(`/api/guilds/${guildId}`, authCookie),
    canModerateGuild(authCookie, guildId),
  ]);
  if (response?.status === 401) redirect('/');
  if (!response?.ok) redirect('/guilds?notice=unavailable');

  return {
    guild,
    user: session.user,
    authCookie,
    access: { canConfigure: true, canModerate },
  };
}

export async function requireGuildOverviewPageData(guildId: string) {
  const [session, authCookie] = await Promise.all([getUserSession(), getAuthCookie()]);
  if (!session || !authCookie) redirect('/');

  const guild = session.guilds.find((entry) => entry.id === guildId);
  if (!guild) redirect('/guilds');

  const canConfigure = canManageGuild(guild);
  const canModerate = await canModerateGuild(authCookie, guildId);
  if (!canConfigure && !canModerate) redirect('/guilds?notice=forbidden');

  if (canConfigure) {
    const response = await requestBotApi(`/api/guilds/${guildId}`, authCookie);
    if (response?.status === 401) redirect('/');
    if (!response?.ok) redirect('/guilds?notice=unavailable');
  }

  return {
    guild,
    user: session.user,
    authCookie,
    access: { canConfigure, canModerate },
  };
}
