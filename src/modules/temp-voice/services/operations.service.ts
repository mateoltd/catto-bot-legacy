/**
 * Unified channel operations service (DRY).
 * Single implementation for every temp voice channel operation.
 * Called from interaction handlers, slash commands, and API routes.
 */

import type { Guild, GuildMember, VoiceBasedChannel, VoiceChannel } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import type { TempVoiceChannel } from '@prisma/client';
import { TempChannelService } from './temp-channel.service.js';
import { TempVoiceConfigService } from './config.service.js';
import { PermissionsService } from './permissions.service.js';
import { UserPreferencesService } from './user-preferences.service.js';
import { ControlPanelService } from './control-panel.service.js';
import type { TempVoiceConfig } from '../models/config.model.js';
import { RateLimitGate } from '#lib/validation/RateLimitGate.js';

/**
 * Result returned by every operation method
 */
export interface OperationResult {
  ok: boolean;
  message: string;
}

/**
 * Context required by most operations — resolved once by the caller
 */
export interface OperationContext {
  guild: Guild;
  guildId: string;
  channelId: string;
  tempChannel: TempVoiceChannel;
  config: TempVoiceConfig;
}

export class ChannelOperationsService {
  constructor(
    private channels: TempChannelService,
    private configService: TempVoiceConfigService,
    private permissions: PermissionsService,
    private userPrefs: UserPreferencesService,
    private controlPanel: ControlPanelService
  ) {}

  // ───── Helpers ─────

  /**
   * Fetch the Discord VoiceChannel, returning an error result if missing.
   */
  private async fetchVoiceChannel(
    guild: Guild,
    channelId: string
  ): Promise<VoiceBasedChannel | null> {
    const ch = await guild.channels.fetch(channelId).catch(() => null);
    if (!ch || !ch.isVoiceBased()) return null;
    return ch;
  }

  /**
   * Persist a user preference when customization is allowed.
   */
  private async savePrefs(
    config: TempVoiceConfig,
    guildId: string,
    ownerId: string,
    data: Parameters<UserPreferencesService['save']>[2]
  ): Promise<void> {
    if (config.allowCustomization) {
      await this.userPrefs.save(guildId, ownerId, data);
    }
  }

  // ───── Lock / Unlock ─────

  async toggleLock(ctx: OperationContext): Promise<OperationResult> {
    const voiceChannel = await this.fetchVoiceChannel(ctx.guild, ctx.channelId);
    if (!voiceChannel) return { ok: false, message: 'Voice channel not found.' };

    const newLockState = !ctx.tempChannel.isLocked;

    await voiceChannel.permissionOverwrites.edit(ctx.guild.roles.everyone, {
      Connect: newLockState ? false : null,
    });

    await this.channels.update(ctx.channelId, { isLocked: newLockState });
    await this.savePrefs(ctx.config, ctx.guildId, ctx.tempChannel.ownerId, {
      preferLocked: newLockState,
    });
    await this.controlPanel.refresh(ctx.channelId);

    return {
      ok: true,
      message: newLockState ? 'Channel locked.' : 'Channel unlocked.',
    };
  }

  // ───── Hide / Show ─────

  async toggleHide(ctx: OperationContext): Promise<OperationResult> {
    const voiceChannel = await this.fetchVoiceChannel(ctx.guild, ctx.channelId);
    if (!voiceChannel) return { ok: false, message: 'Voice channel not found.' };

    const newHiddenState = !ctx.tempChannel.isHidden;

    await voiceChannel.permissionOverwrites.edit(ctx.guild.roles.everyone, {
      ViewChannel: newHiddenState ? false : null,
    });

    await this.channels.update(ctx.channelId, { isHidden: newHiddenState });
    await this.savePrefs(ctx.config, ctx.guildId, ctx.tempChannel.ownerId, {
      preferHidden: newHiddenState,
    });
    await this.controlPanel.refresh(ctx.channelId);

    return {
      ok: true,
      message: newHiddenState ? 'Channel hidden.' : 'Channel visible.',
    };
  }

  // ───── Rename ─────

  async rename(ctx: OperationContext, newName: string): Promise<OperationResult> {
    if (newName.length < 1 || newName.length > 100) {
      return { ok: false, message: 'Channel name must be between 1 and 100 characters.' };
    }

    // Discord enforces 2 name changes per 10 minutes per channel — gate early to avoid hanging
    const rateLimit = await RateLimitGate.check(ctx.channelId, 'tempvoice.rename', {
      maxRequests: 2,
      windowMs: 600_000,
    });
    if (!rateLimit.allowed) {
      const waitMin = Math.ceil((rateLimit.retryAfterMs ?? 0) / 60_000);
      return {
        ok: false,
        message: `Channel name can only be changed twice every 10 minutes. Try again in ~${waitMin} min.`,
      };
    }

    const voiceChannel = await this.fetchVoiceChannel(ctx.guild, ctx.channelId);
    if (!voiceChannel) return { ok: false, message: 'Voice channel not found.' };

    await (voiceChannel as VoiceChannel).setName(newName);
    await this.channels.update(ctx.channelId, { customName: newName });
    await this.savePrefs(ctx.config, ctx.guildId, ctx.tempChannel.ownerId, {
      customName: newName,
    });
    await this.controlPanel.refresh(ctx.channelId);

    return { ok: true, message: `Channel renamed to **${newName}**` };
  }

  // ───── User Limit ─────

  async setLimit(ctx: OperationContext, limit: number): Promise<OperationResult> {
    if (isNaN(limit) || limit < 0 || limit > 99) {
      return { ok: false, message: 'User limit must be a number between 0 and 99.' };
    }

    const voiceChannel = await this.fetchVoiceChannel(ctx.guild, ctx.channelId);
    if (!voiceChannel) return { ok: false, message: 'Voice channel not found.' };

    await (voiceChannel as VoiceChannel).setUserLimit(limit);
    await this.channels.update(ctx.channelId, { customUserLimit: limit });
    await this.savePrefs(ctx.config, ctx.guildId, ctx.tempChannel.ownerId, {
      customUserLimit: limit,
    });
    await this.controlPanel.refresh(ctx.channelId);

    return { ok: true, message: `User limit set to **${limit === 0 ? 'unlimited' : limit}**` };
  }

  // ───── Bitrate ─────

  async setBitrate(ctx: OperationContext, bitrateKbps: number): Promise<OperationResult> {
    if (isNaN(bitrateKbps) || bitrateKbps < 8 || bitrateKbps > 384) {
      return { ok: false, message: 'Bitrate must be between 8 and 384 kbps.' };
    }

    const bitrateInBps = bitrateKbps * 1000;
    const validation = this.permissions.validateBitrate(bitrateInBps, ctx.guild.premiumTier);
    if (!validation.valid) {
      return {
        ok: false,
        message: `Maximum bitrate for this server is **${validation.maxAllowed / 1000}kbps** based on boost level.`,
      };
    }

    const voiceChannel = await this.fetchVoiceChannel(ctx.guild, ctx.channelId);
    if (!voiceChannel) return { ok: false, message: 'Voice channel not found.' };

    await (voiceChannel as VoiceChannel).setBitrate(bitrateInBps);
    await this.channels.update(ctx.channelId, { customBitrate: bitrateInBps });
    await this.savePrefs(ctx.config, ctx.guildId, ctx.tempChannel.ownerId, {
      customBitrate: bitrateKbps,
    });
    await this.controlPanel.refresh(ctx.channelId);

    return { ok: true, message: `Bitrate set to **${bitrateKbps}kbps**` };
  }

  // ───── Region ─────

  async setRegion(ctx: OperationContext, region: string): Promise<OperationResult> {
    const voiceChannel = await this.fetchVoiceChannel(ctx.guild, ctx.channelId);
    if (!voiceChannel) return { ok: false, message: 'Voice channel not found.' };

    const rtcRegion = region === 'auto' ? null : region;
    await (voiceChannel as VoiceChannel).setRTCRegion(rtcRegion);
    await this.channels.update(ctx.channelId, { customRegion: region });
    await this.savePrefs(ctx.config, ctx.guildId, ctx.tempChannel.ownerId, {
      customRegion: region,
    });
    await this.controlPanel.refresh(ctx.channelId);

    return { ok: true, message: `Region set to **${region}**` };
  }

  // ───── Permit ─────

  async permit(ctx: OperationContext, userIds: string[]): Promise<OperationResult> {
    const voiceChannel = await this.fetchVoiceChannel(ctx.guild, ctx.channelId);
    if (!voiceChannel) return { ok: false, message: 'Voice channel not found.' };

    for (const userId of userIds) {
      await voiceChannel.permissionOverwrites.edit(userId, {
        Connect: true,
        ViewChannel: true,
      });
    }

    const currentAllowed = Array.isArray(ctx.tempChannel.allowedUserIds)
      ? (ctx.tempChannel.allowedUserIds as string[])
      : [];
    const currentDenied = Array.isArray(ctx.tempChannel.deniedUserIds)
      ? (ctx.tempChannel.deniedUserIds as string[])
      : [];

    const newAllowed = [...new Set([...currentAllowed, ...userIds])];
    const newDenied = currentDenied.filter((id) => !userIds.includes(id));

    await this.channels.update(ctx.channelId, {
      allowedUserIds: newAllowed,
      deniedUserIds: newDenied,
    });
    await this.savePrefs(ctx.config, ctx.guildId, ctx.tempChannel.ownerId, {
      allowedUserIds: newAllowed,
      deniedUserIds: newDenied,
    });
    await this.controlPanel.refresh(ctx.channelId);

    const mentions = userIds.map((id) => `<@${id}>`).join(', ');
    return { ok: true, message: `Permitted ${mentions} to access this channel.` };
  }

  // ───── Deny ─────

  async deny(ctx: OperationContext, userIds: string[]): Promise<OperationResult> {
    const voiceChannel = await this.fetchVoiceChannel(ctx.guild, ctx.channelId);
    if (!voiceChannel) return { ok: false, message: 'Voice channel not found.' };

    const validUserIds = userIds.filter((id) => id !== ctx.tempChannel.ownerId);
    if (validUserIds.length === 0) {
      return { ok: false, message: 'Cannot deny the channel owner.' };
    }

    for (const userId of validUserIds) {
      await voiceChannel.permissionOverwrites.edit(userId, {
        Connect: false,
        ViewChannel: false,
      });

      // Kick from channel if present
      const member = await ctx.guild.members.fetch(userId).catch(() => null);
      if (member && member.voice.channelId === ctx.channelId) {
        await member.voice.disconnect('Denied access to temporary voice channel');
      }
    }

    const currentDenied = Array.isArray(ctx.tempChannel.deniedUserIds)
      ? (ctx.tempChannel.deniedUserIds as string[])
      : [];
    const currentAllowed = Array.isArray(ctx.tempChannel.allowedUserIds)
      ? (ctx.tempChannel.allowedUserIds as string[])
      : [];
    const currentTrusted = Array.isArray(ctx.tempChannel.trustedUserIds)
      ? (ctx.tempChannel.trustedUserIds as string[])
      : [];

    const newDenied = [...new Set([...currentDenied, ...validUserIds])];
    const newAllowed = currentAllowed.filter((id) => !validUserIds.includes(id));
    const newTrusted = currentTrusted.filter((id) => !validUserIds.includes(id));

    await this.channels.update(ctx.channelId, {
      deniedUserIds: newDenied,
      allowedUserIds: newAllowed,
      trustedUserIds: newTrusted,
    });
    await this.savePrefs(ctx.config, ctx.guildId, ctx.tempChannel.ownerId, {
      deniedUserIds: newDenied,
      allowedUserIds: newAllowed,
      trustedUserIds: newTrusted,
    });
    await this.controlPanel.refresh(ctx.channelId);

    const mentions = validUserIds.map((id) => `<@${id}>`).join(', ');
    return { ok: true, message: `Denied ${mentions} access to this channel.` };
  }

  // ───── Trust Toggle ─────

  async toggleTrust(ctx: OperationContext, userIds: string[]): Promise<OperationResult> {
    const voiceChannel = await this.fetchVoiceChannel(ctx.guild, ctx.channelId);
    if (!voiceChannel) return { ok: false, message: 'Voice channel not found.' };

    const currentTrusted = Array.isArray(ctx.tempChannel.trustedUserIds)
      ? (ctx.tempChannel.trustedUserIds as string[])
      : [];
    const currentAllowed = Array.isArray(ctx.tempChannel.allowedUserIds)
      ? (ctx.tempChannel.allowedUserIds as string[])
      : [];
    const currentDenied = Array.isArray(ctx.tempChannel.deniedUserIds)
      ? (ctx.tempChannel.deniedUserIds as string[])
      : [];

    const validUserIds = userIds.filter((id) => id !== ctx.tempChannel.ownerId);

    const usersToAdd: string[] = [];
    const usersToRemove: string[] = [];

    for (const userId of validUserIds) {
      if (currentTrusted.includes(userId)) {
        usersToRemove.push(userId);
      } else {
        usersToAdd.push(userId);
      }
    }

    // Grant trusted user permissions
    for (const userId of usersToAdd) {
      await voiceChannel.permissionOverwrites.edit(userId, {
        Connect: true,
        ViewChannel: true,
        Speak: true,
        Stream: true,
        UseVAD: true,
      });
    }

    // Downgrade removed trusted users to allowed
    for (const userId of usersToRemove) {
      await voiceChannel.permissionOverwrites.edit(userId, {
        Connect: true,
        ViewChannel: true,
        Speak: null,
        Stream: null,
        UseVAD: null,
      });
    }

    const newTrusted = currentTrusted.filter((id) => !usersToRemove.includes(id));
    newTrusted.push(...usersToAdd);
    const newAllowed = [...new Set([...currentAllowed, ...usersToAdd])];
    const newDenied = currentDenied.filter((id) => !usersToAdd.includes(id));

    await this.channels.update(ctx.channelId, {
      trustedUserIds: newTrusted,
      allowedUserIds: newAllowed,
      deniedUserIds: newDenied,
    });
    await this.savePrefs(ctx.config, ctx.guildId, ctx.tempChannel.ownerId, {
      trustedUserIds: newTrusted,
      allowedUserIds: newAllowed,
      deniedUserIds: newDenied,
    });
    await this.controlPanel.refresh(ctx.channelId);

    const parts: string[] = [];
    if (usersToAdd.length > 0) {
      parts.push(`Trusted ${usersToAdd.map((id) => `<@${id}>`).join(', ')}.`);
    }
    if (usersToRemove.length > 0) {
      parts.push(`Removed trust from ${usersToRemove.map((id) => `<@${id}>`).join(', ')}.`);
    }

    return { ok: true, message: parts.join('\n') || 'The channel owner is already trusted.' };
  }

  // ───── Transfer ─────

  async transfer(ctx: OperationContext, newOwnerId: string): Promise<OperationResult> {
    if (newOwnerId === ctx.tempChannel.ownerId) {
      return { ok: false, message: 'This user is already the owner.' };
    }

    const voiceChannel = await this.fetchVoiceChannel(ctx.guild, ctx.channelId);
    if (!voiceChannel) return { ok: false, message: 'Voice channel not found.' };

    // Verify the target user is in the voice channel (use voice states cache, not REST)
    if (!voiceChannel.members.has(newOwnerId)) {
      return { ok: false, message: 'The target user must be in the voice channel.' };
    }

    // Rebuild permissions atomically with new owner
    await voiceChannel.permissionOverwrites.set(
      this.permissions.buildOverwrites({
        ownerId: newOwnerId,
        guildId: ctx.guildId,
        isLocked: ctx.tempChannel.isLocked,
        isHidden: ctx.tempChannel.isHidden,
        allowedUserIds: (ctx.tempChannel.allowedUserIds as string[]) || [],
        deniedUserIds: (ctx.tempChannel.deniedUserIds as string[]) || [],
        trustedUserIds: (ctx.tempChannel.trustedUserIds as string[]) || [],
      })
    );

    await this.channels.update(ctx.channelId, { ownerId: newOwnerId });
    await this.controlPanel.refresh(ctx.channelId);

    return { ok: true, message: `Channel ownership transferred to <@${newOwnerId}>.` };
  }

  // ───── Claim ─────

  async claim(
    ctx: OperationContext,
    claimerId: string,
    claimerVoiceChannelId: string | null
  ): Promise<OperationResult> {
    // Must be in the channel
    if (claimerVoiceChannelId !== ctx.channelId) {
      return { ok: false, message: 'You must be in the channel to claim it.' };
    }

    const voiceChannel = await this.fetchVoiceChannel(ctx.guild, ctx.channelId);
    if (!voiceChannel) return { ok: false, message: 'Voice channel not found.' };

    // Owner must be absent
    const ownerPresent = voiceChannel.members.has(ctx.tempChannel.ownerId);
    if (ownerPresent) {
      return {
        ok: false,
        message: 'The channel owner is still present. You cannot claim this channel.',
      };
    }

    // Rebuild permissions atomically with new owner
    await voiceChannel.permissionOverwrites.set(
      this.permissions.buildOverwrites({
        ownerId: claimerId,
        guildId: ctx.guildId,
        isLocked: ctx.tempChannel.isLocked,
        isHidden: ctx.tempChannel.isHidden,
        allowedUserIds: (ctx.tempChannel.allowedUserIds as string[]) || [],
        deniedUserIds: (ctx.tempChannel.deniedUserIds as string[]) || [],
        trustedUserIds: (ctx.tempChannel.trustedUserIds as string[]) || [],
      })
    );

    await this.channels.update(ctx.channelId, { ownerId: claimerId });
    await this.controlPanel.refresh(ctx.channelId);

    return { ok: true, message: 'You are now the owner of this channel.' };
  }

  // ───── Reset ─────

  async reset(ctx: OperationContext): Promise<OperationResult> {
    const voiceChannel = await this.fetchVoiceChannel(ctx.guild, ctx.channelId);
    if (!voiceChannel) return { ok: false, message: 'Voice channel not found.' };

    // Reset Discord channel settings
    await (voiceChannel as VoiceChannel).edit({
      userLimit: ctx.config.defaultUserLimit,
      bitrate: ctx.config.defaultBitrate ?? undefined,
      rtcRegion:
        ctx.config.defaultRegion && ctx.config.defaultRegion !== 'auto'
          ? ctx.config.defaultRegion
          : null,
    });

    // Reset permissions
    await voiceChannel.permissionOverwrites.set(
      this.permissions.buildOverwrites({
        ownerId: ctx.tempChannel.ownerId,
        guildId: ctx.guildId,
        isLocked: ctx.config.defaultLocked,
        isHidden: ctx.config.defaultHidden,
        allowedUserIds: [],
        deniedUserIds: [],
        trustedUserIds: [],
      })
    );

    // Reset database — includes trustedUserIds (bug fix)
    await this.channels.update(ctx.channelId, {
      isLocked: ctx.config.defaultLocked,
      isHidden: ctx.config.defaultHidden,
      customUserLimit: ctx.config.defaultUserLimit,
      customBitrate: ctx.config.defaultBitrate ?? undefined,
      customRegion: ctx.config.defaultRegion || 'auto',
      customName: null,
      allowedUserIds: [],
      deniedUserIds: [],
      trustedUserIds: [],
    });

    await this.controlPanel.refresh(ctx.channelId);

    return { ok: true, message: 'Channel reset to default settings.' };
  }

  // ───── Kick ─────

  async kick(ctx: OperationContext, userIds: string[]): Promise<OperationResult> {
    const validUserIds = userIds.filter((id) => id !== ctx.tempChannel.ownerId);
    if (validUserIds.length === 0) {
      return { ok: false, message: 'Cannot kick the channel owner.' };
    }

    const kicked: string[] = [];
    for (const userId of validUserIds) {
      const member = await ctx.guild.members.fetch(userId).catch(() => null);
      if (member && member.voice.channelId === ctx.channelId) {
        await member.voice.disconnect('Kicked from temporary voice channel');
        kicked.push(userId);
      }
    }

    if (kicked.length === 0) {
      return { ok: false, message: 'No selected users are in the channel.' };
    }

    const mentions = kicked.map((id) => `<@${id}>`).join(', ');
    return { ok: true, message: `Kicked ${mentions} from the channel.` };
  }

  // ───── Access check helper ─────

  /**
   * Check if a member can manage a temp channel.
   * Returns null if allowed, or an error message string if denied.
   */
  checkAccess(
    member: GuildMember,
    tempChannel: TempVoiceChannel,
    config: TempVoiceConfig
  ): string | null {
    const trustedUserIds = Array.isArray(tempChannel.trustedUserIds)
      ? (tempChannel.trustedUserIds as string[])
      : [];

    const canManage = this.permissions.canManageChannel(
      member.user.id,
      tempChannel.ownerId,
      config.adminRoleIds || [],
      member.roles.cache?.map((r) => r.id) || [],
      member.permissions?.has(PermissionFlagsBits.Administrator) || false,
      trustedUserIds
    );

    return canManage ? null : 'You do not have permission to manage this channel.';
  }

  /**
   * Build a full operation context from commonly available data.
   * Returns null if temp channel not found.
   */
  async buildContext(guild: Guild, channelId: string): Promise<OperationContext | null> {
    const tempChannel = await this.channels.getByChannelId(channelId);
    if (!tempChannel) return null;

    const config = await this.configService.get(guild.id);

    return {
      guild,
      guildId: guild.id,
      channelId,
      tempChannel,
      config,
    };
  }
}
