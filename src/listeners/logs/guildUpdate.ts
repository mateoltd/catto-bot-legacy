import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import type { Guild } from 'discord.js';
import { LogType, logAction } from '../../lib/services/logging.js';
import { LogListener } from './LogListener.js';

export class GuildUpdateListener extends LogListener<typeof Events.GuildUpdate> {
  public constructor(context: Listener.LoaderContext, options: ListenerOptions) {
    super(context, {
      ...options,
      event: Events.GuildUpdate,
    });
  }

  public async run(oldGuild: Guild, newGuild: Guild) {
    const changes: Array<{ name: string; value: string }> = [];

    if (oldGuild.name !== newGuild.name) {
      changes.push({
        name: 'Name',
        value: `**Before:** ${oldGuild.name}\n**After:** ${newGuild.name}`,
      });
    }

    if (oldGuild.icon !== newGuild.icon) {
      changes.push({
        name: 'Icon',
        value: newGuild.icon ? 'Icon updated' : 'Icon removed',
      });
    }

    if (oldGuild.banner !== newGuild.banner) {
      changes.push({
        name: 'Banner',
        value: newGuild.banner ? 'Banner updated' : 'Banner removed',
      });
    }

    if (oldGuild.description !== newGuild.description) {
      changes.push({
        name: 'Description',
        value: `**Before:** ${oldGuild.description || '*No description*'}\n**After:** ${newGuild.description || '*No description*'}`,
      });
    }

    if (oldGuild.preferredLocale !== newGuild.preferredLocale) {
      changes.push({
        name: 'Preferred Language',
        value: `**Before:** ${oldGuild.preferredLocale}\n**After:** ${newGuild.preferredLocale}`,
      });
    }

    if (oldGuild.afkChannelId !== newGuild.afkChannelId) {
      changes.push({
        name: 'AFK Channel',
        value: `**Before:** ${oldGuild.afkChannelId ? `<#${oldGuild.afkChannelId}>` : '*No AFK channel*'}\n**After:** ${newGuild.afkChannelId ? `<#${newGuild.afkChannelId}>` : '*No AFK channel*'}`,
      });
    }

    if (oldGuild.systemChannelId !== newGuild.systemChannelId) {
      changes.push({
        name: 'System Channel',
        value: `**Before:** ${oldGuild.systemChannelId ? `<#${oldGuild.systemChannelId}>` : '*No channel*'}\n**After:** ${newGuild.systemChannelId ? `<#${newGuild.systemChannelId}>` : '*No channel*'}`,
      });
    }

    if (oldGuild.rulesChannelId !== newGuild.rulesChannelId) {
      changes.push({
        name: 'Rules Channel',
        value: `**Before:** ${oldGuild.rulesChannelId ? `<#${oldGuild.rulesChannelId}>` : '*No channel*'}\n**After:** ${newGuild.rulesChannelId ? `<#${newGuild.rulesChannelId}>` : '*No channel*'}`,
      });
    }

    if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
      changes.push({
        name: 'Verification Level',
        value: `**Before:** ${oldGuild.verificationLevel}\n**After:** ${newGuild.verificationLevel}`,
      });
    }

    if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) {
      changes.push({
        name: 'Explicit Content Filter',
        value: `**Before:** ${oldGuild.explicitContentFilter}\n**After:** ${newGuild.explicitContentFilter}`,
      });
    }

    if (oldGuild.mfaLevel !== newGuild.mfaLevel) {
      changes.push({
        name: 'MFA Level',
        value: `**Before:** ${oldGuild.mfaLevel}\n**After:** ${newGuild.mfaLevel}`,
      });
    }

    // Only log if there are actual changes
    if (changes.length === 0) return;

    await logAction({
      guildId: newGuild.id,
      type: LogType.Server,
      title: 'Server Updated',
      description: 'Server settings were updated',
      fields: changes,
      color: 0x5865f2, // Blurple
      thumbnail: newGuild.iconURL() || undefined,
    });
  }
}
