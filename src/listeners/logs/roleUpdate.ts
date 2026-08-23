import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { Role } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class RoleUpdateListener extends LogListener<typeof Events.GuildRoleUpdate> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.GuildRoleUpdate,
    });
  }

  public async run(oldRole: Role, newRole: Role) {
    const changes: Array<{ name: string; value: string }> = [];

    if (oldRole.name !== newRole.name) {
      changes.push({
        name: 'Name',
        value: `**Before:** ${oldRole.name}\n**After:** ${newRole.name}`,
      });
    }

    if (oldRole.hexColor !== newRole.hexColor) {
      changes.push({
        name: 'Color',
        value: `**Before:** ${oldRole.hexColor}\n**After:** ${newRole.hexColor}`,
      });
    }

    if (oldRole.mentionable !== newRole.mentionable) {
      changes.push({
        name: 'Mentionable',
        value: `**Before:** ${oldRole.mentionable ? 'Yes' : 'No'}\n**After:** ${newRole.mentionable ? 'Yes' : 'No'}`,
      });
    }

    if (oldRole.hoist !== newRole.hoist) {
      changes.push({
        name: 'Hoisted',
        value: `**Before:** ${oldRole.hoist ? 'Yes' : 'No'}\n**After:** ${newRole.hoist ? 'Yes' : 'No'}`,
      });
    }

    if (oldRole.position !== newRole.position) {
      changes.push({
        name: 'Position',
        value: `**Before:** ${oldRole.position}\n**After:** ${newRole.position}`,
      });
    }

    // Check permission changes
    const addedPerms = newRole.permissions.missing(oldRole.permissions);
    const removedPerms = oldRole.permissions.missing(newRole.permissions);

    if (addedPerms.length > 0) {
      changes.push({
        name: 'Permissions Added',
        value: addedPerms
          .map((p) => `\`${p}\``)
          .join(', ')
          .substring(0, 1024),
      });
    }

    if (removedPerms.length > 0) {
      changes.push({
        name: 'Permissions Removed',
        value: removedPerms
          .map((p) => `\`${p}\``)
          .join(', ')
          .substring(0, 1024),
      });
    }

    // Only log if there are actual changes
    if (changes.length === 0) return;

    await logAction({
      guildId: newRole.guild.id,
      type: LogType.Roles,
      title: 'Role Updated',
      description: `Role ${newRole} was updated`,
      fields: [{ name: 'Role', value: `${newRole} (${newRole.id})`, inline: true }, ...changes],
      color: newRole.color || 0xfee75c, // Role color or yellow
    });
  }
}
