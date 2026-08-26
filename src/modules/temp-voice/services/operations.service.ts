import type { Guild, GuildMember } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import {
  TempVoiceOwnershipStatus,
  type TempVoiceChannel,
} from "@prisma/client";

import type { TempVoiceChannelCommand } from "../domain/temp-voice.messages.js";
import type { TempVoiceConfig } from "../models/config.model.js";
import { getTempVoiceTransport } from "../application/temp-voice-runtime.js";
import { TempChannelService } from "./temp-channel.service.js";
import { TempVoiceConfigService } from "./config.service.js";

type TempVoiceChannelCommandBody<T = TempVoiceChannelCommand> =
  T extends TempVoiceChannelCommand
    ? Omit<T, "guildId" | "channelId" | "actorId">
    : never;

export interface OperationResult {
  readonly ok: boolean;
  readonly message: string;
}

export interface OperationContext {
  readonly guild: Guild;
  readonly guildId: string;
  readonly channelId: string;
  readonly actorId: string;
  readonly tempChannel: TempVoiceChannel;
  readonly config: TempVoiceConfig;
}

export class ChannelOperationsService {
  public constructor(
    private readonly channels: TempChannelService,
    private readonly configService: TempVoiceConfigService,
  ) {}

  public toggleLock(ctx: OperationContext): Promise<OperationResult> {
    return this.submit(ctx, { kind: "TOGGLE_LOCK" });
  }

  public toggleHide(ctx: OperationContext): Promise<OperationResult> {
    return this.submit(ctx, { kind: "TOGGLE_HIDE" });
  }

  public rename(ctx: OperationContext, name: string): Promise<OperationResult> {
    return this.submit(ctx, { kind: "RENAME_CHANNEL", name });
  }

  public setLimit(
    ctx: OperationContext,
    value: number,
  ): Promise<OperationResult> {
    return this.submit(ctx, { kind: "SET_USER_LIMIT", value });
  }

  public setBitrate(
    ctx: OperationContext,
    value: number,
  ): Promise<OperationResult> {
    return this.submit(ctx, { kind: "SET_BITRATE", value });
  }

  public setRegion(
    ctx: OperationContext,
    region: string,
  ): Promise<OperationResult> {
    return this.submit(ctx, { kind: "SET_REGION", region });
  }

  public permit(
    ctx: OperationContext,
    userIds: string[],
  ): Promise<OperationResult> {
    return this.submit(ctx, { kind: "PERMIT_USERS", userIds });
  }

  public deny(
    ctx: OperationContext,
    userIds: string[],
  ): Promise<OperationResult> {
    return this.submit(ctx, { kind: "DENY_USERS", userIds });
  }

  public toggleTrust(
    ctx: OperationContext,
    userIds: string[],
  ): Promise<OperationResult> {
    return this.submit(ctx, { kind: "TOGGLE_TRUST", userIds });
  }

  public transfer(
    ctx: OperationContext,
    targetUserId: string,
  ): Promise<OperationResult> {
    return this.submit(ctx, { kind: "TRANSFER_OWNERSHIP", targetUserId });
  }

  public claim(
    ctx: OperationContext,
    claimerId: string,
    _claimerVoiceChannelId: string | null,
  ): Promise<OperationResult> {
    return this.submit(
      { ...ctx, actorId: claimerId },
      { kind: "CLAIM_OWNERSHIP" },
    );
  }

  public reset(ctx: OperationContext): Promise<OperationResult> {
    return this.submit(ctx, { kind: "RESET_SETTINGS" });
  }

  public kick(
    ctx: OperationContext,
    userIds: string[],
  ): Promise<OperationResult> {
    return this.submit(ctx, { kind: "KICK_USERS", userIds });
  }

  public reconcile(ctx: OperationContext): Promise<OperationResult> {
    return this.submit(ctx, { kind: "RECONCILE_CHANNEL" });
  }

  public checkAccess(
    member: GuildMember,
    tempChannel: TempVoiceChannel,
    config: TempVoiceConfig,
  ): string | null {
    const trustedUserIds = Array.isArray(tempChannel.trustedUserIds)
      ? (tempChannel.trustedUserIds as string[])
      : [];
    const canManage =
      (tempChannel.ownershipStatus !== TempVoiceOwnershipStatus.CLAIMABLE &&
        member.id === tempChannel.ownerId) ||
      trustedUserIds.includes(member.id) ||
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      config.adminRoleIds.some((roleId) => member.roles.cache.has(roleId));
    return canManage
      ? null
      : "You do not have permission to manage this channel.";
  }

  public checkTransferAccess(
    member: GuildMember,
    tempChannel: TempVoiceChannel,
    config: TempVoiceConfig,
  ): string | null {
    const canTransfer =
      (tempChannel.ownershipStatus !== TempVoiceOwnershipStatus.CLAIMABLE &&
        member.id === tempChannel.ownerId) ||
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      config.adminRoleIds.some((roleId) => member.roles.cache.has(roleId));
    return canTransfer
      ? null
      : "Only the owner or a server administrator can transfer ownership.";
  }

  public async buildContext(
    guild: Guild,
    channelId: string,
    actorId: string,
  ): Promise<OperationContext | null> {
    const tempChannel = await this.channels.getByChannelId(channelId);
    if (!tempChannel) return null;
    const config = await this.configService.getOrNull(guild.id);
    if (!config || config.drainingAt) return null;
    return {
      guild,
      guildId: guild.id,
      channelId,
      actorId,
      tempChannel,
      config,
    };
  }

  private async submit(
    ctx: OperationContext,
    body: TempVoiceChannelCommandBody,
  ): Promise<OperationResult> {
    const result = await getTempVoiceTransport().submit({
      ...body,
      guildId: ctx.guildId,
      channelId: ctx.channelId,
      actorId: ctx.actorId,
    } as TempVoiceChannelCommand);
    return result.ok
      ? { ok: true, message: result.data.message }
      : { ok: false, message: result.message };
  }
}
