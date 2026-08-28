import { container } from '@sapphire/framework';
import {
  ActivityType,
  type Activity,
  type Guild,
  type GuildMember,
  type Presence,
} from 'discord.js';
import { getVanityConfig } from './config.service.js';

export type VanitySyncSource = 'live' | 'reconcile';

export interface VanitySyncResult {
  outcome: 'added' | 'removed' | 'unchanged' | 'ignored' | 'unconfigured';
}

const THANK_YOU_COOLDOWN_SECONDS = 2 * 60 * 60;
const memberSyncs = new Map<string, Promise<VanitySyncResult>>();

export function hasVanityKeyword(
  activities: readonly Pick<Activity, 'type' | 'state'>[],
  keyword: string,
): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return false;

  return activities.some(
    (activity) =>
      activity.type === ActivityType.Custom &&
      typeof activity.state === 'string' &&
      activity.state.toLowerCase().includes(normalizedKeyword),
  );
}

function isUsablePresence(presence: Presence | null): presence is Presence {
  return Boolean(presence && presence.status !== 'offline');
}

function renderThankYouMessage(
  template: string,
  member: GuildMember,
  roleId: string,
  keyword: string,
): string {
  return template
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{role}', `<@&${roleId}>`)
    .replaceAll('{keyword}', keyword);
}

async function sendThankYou(
  member: GuildMember,
  channelId: string,
  roleId: string,
  keyword: string,
  template: string,
): Promise<void> {
  const channel = member.guild.channels.cache.get(channelId);
  if (!channel?.isSendable()) return;

  const cooldownKey = `vanity:thanks:${member.guild.id}:${member.id}`;
  let claimedCooldown = false;
  try {
    claimedCooldown =
      (await container.redis.set(cooldownKey, '1', 'EX', THANK_YOU_COOLDOWN_SECONDS, 'NX')) ===
      'OK';
  } catch (error) {
    container.logger.warn(
      `[Vanity] Skipping thank-you for ${member.id}; Redis cooldown unavailable:`,
      error,
    );
    return;
  }

  if (!claimedCooldown) return;

  try {
    await channel.send({
      content: renderThankYouMessage(template, member, roleId, keyword),
      allowedMentions: { parse: [], users: [member.id], roles: [] },
    });
  } catch (error) {
    await container.redis.del(cooldownKey).catch(() => undefined);
    container.logger.warn(`[Vanity] Failed to send thank-you for ${member.id}:`, error);
  }
}

export async function syncVanityMember(
  member: GuildMember,
  source: VanitySyncSource,
): Promise<VanitySyncResult> {
  if (member.user.bot || !isUsablePresence(member.presence)) return { outcome: 'ignored' };

  const config = await getVanityConfig(member.guild.id);
  if (!config?.enabled || !config.roleId || !config.keyword.trim()) {
    return { outcome: 'unconfigured' };
  }

  const role = member.guild.roles.cache.get(config.roleId);
  if (!role) {
    container.logger.warn(
      `[Vanity] Configured role ${config.roleId} no longer exists in guild ${member.guild.id}`,
    );
    return { outcome: 'ignored' };
  }

  const wantsRole = hasVanityKeyword(member.presence.activities, config.keyword);
  const hasRole = member.roles.cache.has(role.id);
  if (wantsRole === hasRole) return { outcome: 'unchanged' };

  if (wantsRole) {
    await member.roles.add(role, 'Vanity status matched configured keyword');
    if (
      source === 'live' &&
      config.thankYouEnabled &&
      config.thankYouChannelId &&
      config.thankYouMessage
    ) {
      await sendThankYou(
        member,
        config.thankYouChannelId,
        role.id,
        config.keyword,
        config.thankYouMessage,
      );
    }
    return { outcome: 'added' };
  }

  await member.roles.remove(role, 'Vanity status no longer matches configured keyword');
  return { outcome: 'removed' };
}

export function enqueueVanitySync(
  member: GuildMember,
  source: VanitySyncSource,
): Promise<VanitySyncResult> {
  const key = `${member.guild.id}:${member.id}`;
  const previous = memberSyncs.get(key) ?? Promise.resolve({ outcome: 'unchanged' } as const);
  const current = previous
    .catch(() => ({ outcome: 'ignored' }) as const)
    .then(() => syncVanityMember(member, source));

  memberSyncs.set(key, current);
  const clearCurrent = () => {
    if (memberSyncs.get(key) === current) memberSyncs.delete(key);
  };
  void current.then(clearCurrent, clearCurrent);
  return current;
}

export async function handleVanityPresence(presence: Presence): Promise<VanitySyncResult> {
  if (!isUsablePresence(presence)) return { outcome: 'ignored' };
  const guild = presence.guild;
  if (!guild) return { outcome: 'ignored' };
  const member = presence.member ?? guild.members.cache.get(presence.userId);
  if (!member) return { outcome: 'ignored' };
  return enqueueVanitySync(member, 'live');
}

export async function reconcileGuildVanity(guild: Guild): Promise<{
  checked: number;
  changed: number;
  failed: number;
}> {
  const config = await getVanityConfig(guild.id);
  if (!config?.enabled) return { checked: 0, changed: 0, failed: 0 };

  const members = [...guild.presences.cache.values()]
    .filter(isUsablePresence)
    .map((presence) => presence.member ?? guild.members.cache.get(presence.userId))
    .filter((member): member is GuildMember => Boolean(member));

  let cursor = 0;
  let changed = 0;
  let failed = 0;
  const workerCount = Math.min(5, members.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < members.length) {
        const member = members[cursor++];
        if (!member) continue;
        try {
          const result = await enqueueVanitySync(member, 'reconcile');
          if (result.outcome === 'added' || result.outcome === 'removed') changed++;
        } catch (error) {
          failed++;
          container.logger.warn(`[Vanity] Failed to reconcile member ${member.id}:`, error);
        }
      }
    }),
  );

  return { checked: members.length, changed, failed };
}

export async function reconcileAllGuildVanities(guilds: Iterable<Guild>): Promise<void> {
  for (const guild of guilds) {
    const result = await reconcileGuildVanity(guild);
    if (result.checked > 0 || result.failed > 0) {
      container.logger.info(
        `[Vanity] Reconciled guild ${guild.id}: ${result.changed}/${result.checked} changed, ${result.failed} failed`,
      );
    }
  }
}
