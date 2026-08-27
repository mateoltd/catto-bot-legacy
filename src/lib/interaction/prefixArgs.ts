import type { Args } from '@sapphire/framework';
import type { Message, User } from 'discord.js';

const USER_MENTION = /^<@!?(\d{17,20})>$/;
const SNOWFLAKE = /^\d{17,20}$/;

/** Read all remaining Sapphire message-command arguments without throwing on an empty list. */
export async function readPrefixArgs(args: Args): Promise<string[]> {
  return args.repeat('string').catch(() => []);
}

/**
 * Resolve the same user-shaped argument accepted by Discord's slash user option.
 * Mentions and IDs are exact; names use Discord's member query as a convenience.
 */
export async function resolvePrefixUser(message: Message<true>, raw: string): Promise<User | null> {
  const mentionId = USER_MENTION.exec(raw)?.[1];
  const userId = mentionId ?? (SNOWFLAKE.test(raw) ? raw : null);

  if (userId) {
    const mentioned = message.mentions.users.get(userId);
    if (mentioned) return mentioned;

    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (member) return member.user;

    return message.client.users.fetch(userId).catch(() => null);
  }

  const members = await message.guild.members.fetch({ query: raw, limit: 5 }).catch(() => null);
  if (!members) return null;

  const normalized = raw.toLocaleLowerCase();
  const exact = members.find(
    (member) =>
      member.user.username.toLocaleLowerCase() === normalized ||
      member.displayName.toLocaleLowerCase() === normalized
  );

  return (exact ?? members.first())?.user ?? null;
}

export function parsePrefixBoolean(raw: string | undefined): boolean | null {
  if (raw === undefined) return null;
  if (['true', 'yes', 'on', '1'].includes(raw.toLocaleLowerCase())) return true;
  if (['false', 'no', 'off', '0'].includes(raw.toLocaleLowerCase())) return false;
  return null;
}
