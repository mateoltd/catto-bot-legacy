import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { GuildMember } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { time, TimestampStyles } from '@discordjs/builders';
import { LogListener } from './LogListener.js';

export class GuildMemberAddListener extends LogListener<typeof Events.GuildMemberAdd> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.GuildMemberAdd,
    });
  }

  public async run(member: GuildMember) {
    if (member.user.bot) return;

    const accountAge = Date.now() - member.user.createdTimestamp;
    const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));

    await logAction({
      guildId: member.guild.id,
      type: LogType.Joins,
      title: 'User Joined Server',
      description: `${member.user} joined the server`,
      fields: [
        { name: 'User', value: `${member.user.tag} (${member.user.id})`, inline: true },
        {
          name: 'Account Created',
          value: time(member.user.createdAt, TimestampStyles.RelativeTime),
          inline: true,
        },
        { name: 'Account Age', value: `${accountAgeDays} days`, inline: true },
        { name: 'Total Members', value: `${member.guild.memberCount}`, inline: true },
      ],
      color: 0x57f287, // Green
      thumbnail: member.user.displayAvatarURL(),
    });
  }
}
