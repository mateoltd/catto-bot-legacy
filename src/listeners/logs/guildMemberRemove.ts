import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { GuildMember, PartialGuildMember } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { time, TimestampStyles } from '@discordjs/builders';
import { LogListener } from './LogListener.js';

export class GuildMemberRemoveListener extends LogListener<typeof Events.GuildMemberRemove> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.GuildMemberRemove,
    });
  }

  public async run(member: GuildMember | PartialGuildMember) {
    if (member.user.bot) return;

    const joinedAt = member.joinedAt;
    const timeInServer = joinedAt ? Date.now() - joinedAt.getTime() : null;
    const daysInServer = timeInServer ? Math.floor(timeInServer / (1000 * 60 * 60 * 24)) : null;

    const roles = member.roles.cache
      .filter((role) => role.id !== member.guild.id)
      .map((role) => role.name);

    await logAction({
      guildId: member.guild.id,
      type: LogType.Leaves,
      title: 'User Left Server',
      description: `${member.user} left the server`,
      fields: [
        { name: 'User', value: `${member.user.tag} (${member.user.id})`, inline: true },
        ...(joinedAt
          ? [
              {
                name: 'Joined',
                value: time(joinedAt, TimestampStyles.RelativeTime),
                inline: true,
              },
            ]
          : []),
        ...(daysInServer !== null
          ? [
              {
                name: 'Time in Server',
                value: `${daysInServer} days`,
                inline: true,
              },
            ]
          : []),
        { name: 'Total Members', value: `${member.guild.memberCount}`, inline: true },
        ...(roles.length > 0
          ? [
              {
                name: `Roles (${roles.length})`,
                value: roles.slice(0, 20).join(', '),
              },
            ]
          : []),
      ],
      color: 0xed4245, // Red
      thumbnail: member.user.displayAvatarURL(),
    });
  }
}
