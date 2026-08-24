import type { Guild } from '@/lib/types';

const MANAGE_GUILD_PERMISSION = BigInt(1) << BigInt(5);

export function canManageGuild(guild: Pick<Guild, 'owner' | 'permissions'>): boolean {
  if (guild.owner) return true;

  try {
    return (BigInt(guild.permissions) & MANAGE_GUILD_PERMISSION) !== BigInt(0);
  } catch {
    return false;
  }
}
