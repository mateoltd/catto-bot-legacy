import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { GuildMember, PartialGuildMember } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class GuildMemberUpdateListener extends LogListener<typeof Events.GuildMemberUpdate> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.GuildMemberUpdate,
    });
  }

  public async run(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    if (newMember.user.bot) return;

    const changes: Array<{ name: string; value: string }> = [];

    // Nickname change
    if (oldMember.nickname !== newMember.nickname) {
      changes.push({
        name: 'Nickname',
        value: `**Before:** ${oldMember.nickname || '*No nickname*'}\n**After:** ${newMember.nickname || '*No nickname*'}`,
      });
    }

    // Role changes
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const addedRoles = newRoles.filter(
      (role) => !oldRoles.has(role.id) && role.id !== newMember.guild.id
    );
    const removedRoles = oldRoles.filter(
      (role) => !newRoles.has(role.id) && role.id !== newMember.guild.id
    );

    if (addedRoles.size > 0) {
      changes.push({
        name: 'Roles Added',
        value: addedRoles.map((role) => role.toString()).join(', '),
      });
    }

    if (removedRoles.size > 0) {
      changes.push({
        name: 'Roles Removed',
        value: removedRoles.map((role) => role.toString()).join(', '),
      });
    }

    // Timeout changes
    if (
      oldMember.communicationDisabledUntil?.getTime() !==
      newMember.communicationDisabledUntil?.getTime()
    ) {
      if (newMember.communicationDisabledUntil) {
        changes.push({
          name: 'Timeout',
          value: `User timed out until <t:${Math.floor(newMember.communicationDisabledUntil.getTime() / 1000)}:F>`,
        });
      } else if (oldMember.communicationDisabledUntil) {
        changes.push({
          name: 'Timeout',
          value: 'Timeout removed',
        });
      }
    }

    // Only log if there are actual changes
    if (changes.length === 0) return;

    await logAction({
      guildId: newMember.guild.id,
      type: LogType.Members,
      title: 'Member Updated',
      description: `${newMember.user} was updated`,
      fields: [
        { name: 'User', value: `${newMember.user.tag} (${newMember.user.id})`, inline: true },
        ...changes,
      ],
      color: 0x5865f2, // Blurple
      thumbnail: newMember.user.displayAvatarURL(),
    });
  }
}
