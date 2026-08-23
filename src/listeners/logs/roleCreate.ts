import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { Role } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class RoleCreateListener extends LogListener<typeof Events.GuildRoleCreate> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.GuildRoleCreate,
    });
  }

  public async run(role: Role) {
    await logAction({
      guildId: role.guild.id,
      type: LogType.Roles,
      title: 'Role Created',
      description: `Role ${role} was created`,
      fields: [
        { name: 'Name', value: role.name, inline: true },
        { name: 'ID', value: role.id, inline: true },
        { name: 'Color', value: role.hexColor, inline: true },
        { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
        { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
        { name: 'Position', value: `${role.position}`, inline: true },
      ],
      color: role.color || 0x57f287, // Role color or green
    });
  }
}
