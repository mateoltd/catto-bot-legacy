import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { Role } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class RoleDeleteListener extends LogListener<typeof Events.GuildRoleDelete> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.GuildRoleDelete,
    });
  }

  public async run(role: Role) {
    await logAction({
      guildId: role.guild.id,
      type: LogType.Roles,
      title: 'Role Deleted',
      description: `Role **${role.name}** was deleted`,
      fields: [
        { name: 'Name', value: role.name, inline: true },
        { name: 'ID', value: role.id, inline: true },
        { name: 'Color', value: role.hexColor, inline: true },
        { name: 'Members', value: `${role.members.size}`, inline: true },
      ],
      color: 0xed4245, // Red
    });
  }
}
