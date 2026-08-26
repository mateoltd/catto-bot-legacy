import { randomUUID } from "node:crypto";

import { container } from "@sapphire/framework";
import {
  AuditLogEvent,
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type OverwriteResolvable,
  type VoiceChannel,
} from "discord.js";
import {
  Prisma,
  TempVoiceEffectKind,
  TempVoiceLifecycle,
  TempVoiceOutboxStatus,
  type PrismaClient,
  type TempVoiceOutbox,
} from "@prisma/client";

import { findSuitableCategory } from "../utils/fallback.util.js";
import { generateChannelName } from "../utils/naming.util.js";
import { REDIS_KEYS, VOICE_REGIONS } from "../constants.js";
import type { TempVoiceConfig } from "../models/config.model.js";
import type {
  TempVoiceChannelCommand,
  TempVoiceCommand,
  TempVoiceSignal,
  TempVoiceTransportMessage,
} from "../domain/temp-voice.messages.js";
import { TempVoicePolicy } from "../domain/temp-voice.policy.js";
import {
  asTempVoiceUserId,
  hasCurrentTempVoiceOwner,
  isCurrentTempVoiceOwner,
  TempVoiceLifecycleState,
  TempVoiceOwnershipState,
} from "../domain/temp-voice.types.js";
import type {
  TempVoiceRecord,
  TempVoiceFailure,
  TempVoiceResult,
} from "../domain/temp-voice.types.js";
import type {
  TempVoiceOutboxWrite,
  TempVoiceRecordUpdate,
  TempVoiceRepository,
} from "../ports/temp-voice-repository.port.js";
import type { TempVoiceClock } from "../ports/temp-voice-clock.port.js";
import type { TempVoiceProjection } from "../ports/temp-voice-projection.port.js";
import type { TempVoiceLeaseRunner } from "../ports/temp-voice-lease.port.js";
import type {
  TempVoiceConfigProvider,
  TempVoicePreferenceStore,
} from "../ports/temp-voice-settings.port.js";
import { classifyDiscordError } from "../infrastructure/discord-error-classifier.js";

const DEEP_RECONCILE_INTERVAL_MS = 300_000;
const MISSING_PERMISSION_RETRY_MS = 300_000;
const MAX_ERROR_MESSAGE_LENGTH = 1_000;

const success = (message: string): TempVoiceResult<{ message: string }> => ({
  ok: true,
  data: { message },
});

const failure = (
  code: string,
  message: string,
  retryable = false,
): TempVoiceFailure => ({ ok: false, code, message, retryable });

const unique = (values: readonly string[]): string[] => [...new Set(values)];

export class TempVoiceCoordinator {
  private readonly policy = new TempVoicePolicy();

  public constructor(
    private readonly prisma: PrismaClient,
    private readonly repository: TempVoiceRepository,
    private readonly clock: TempVoiceClock,
    private readonly configService: TempVoiceConfigProvider,
    private readonly userPreferences: TempVoicePreferenceStore,
    private readonly projector: TempVoiceProjection,
    private readonly leases: TempVoiceLeaseRunner,
  ) {}

  public async dispatch(
    message: TempVoiceTransportMessage,
  ): Promise<TempVoiceResult<{ message: string }>> {
    if (message.type === "COMMAND") return this.executeCommand(message.command);
    if (message.type === "SIGNAL") return this.handleSignal(message.signal);
    return this.processOutbox(message.outboxId);
  }

  private async executeCommand(
    command: TempVoiceCommand,
  ): Promise<TempVoiceResult<{ message: string }>> {
    if (command.kind === "CREATE_FROM_JOIN") {
      return this.leases.withLease(
        `member:${command.guildId}:${command.actorId}`,
        () =>
          this.createFromJoin(
            command.guildId,
            command.actorId,
            command.sourceChannelId,
          ),
      );
    }

    const record = await this.repository.findByChannelId(command.channelId);
    if (!record || record.guildId !== command.guildId) {
      return failure(
        "CHANNEL_NOT_FOUND",
        "This temporary voice channel no longer exists.",
      );
    }
    const acquiringOwnerId =
      command.kind === "TRANSFER_OWNERSHIP"
        ? command.targetUserId
        : command.kind === "CLAIM_OWNERSHIP"
          ? command.actorId
          : null;
    const execute = () =>
      this.leases.withLease(`aggregate:${record.id}`, () =>
        this.executeChannelCommand(command),
      );
    return acquiringOwnerId
      ? this.leases.withLease(
          `member:${command.guildId}:${acquiringOwnerId}`,
          execute,
        )
      : execute();
  }

  private async handleSignal(
    signal: TempVoiceSignal,
  ): Promise<TempVoiceResult<{ message: string }>> {
    switch (signal.kind) {
      case "VOICE_STATE_OBSERVED":
        return this.handleVoiceStateObserved(signal);
      case "CHANNEL_PRESENCE_DIRTY": {
        const record = await this.repository.findByChannelId(signal.channelId);
        if (!record || record.guildId !== signal.guildId) {
          return success("Channel presence is not managed by temp voice.");
        }
        return this.leases.withLease(`aggregate:${record.id}`, () =>
          this.reconcileRecord(record, false),
        );
      }
      case "CHANNEL_DELETED": {
        const record = await this.repository.findByChannelId(signal.channelId);
        if (!record) return success("Channel deletion observed.");
        return this.leases.withLease(`aggregate:${record.id}`, async () => {
          await this.repository.markDeleted(record.id, this.clock.now());
          return success("Channel deletion observed.");
        });
      }
      case "CHANNEL_UPDATED":
        return this.handleChannelUpdated(signal);
      case "RECONCILE_DUE":
        return this.leases.withLease(
          `aggregate:${signal.aggregateId}`,
          async () => {
            const record = await this.repository.findById(signal.aggregateId);
            if (!record) return success("Aggregate no longer exists.");
            if (
              signal.expectedOwnershipEpoch !== undefined &&
              signal.expectedOwnershipEpoch !== record.ownershipEpoch
            ) {
              return success("Stale ownership deadline ignored.");
            }
            return this.reconcileRecord(record, true);
          },
        );
      case "RECONCILE_GUILD": {
        const records = await this.repository.listByGuild(signal.guildId);
        for (const record of records) {
          await this.leases.withLease(`aggregate:${record.id}`, () =>
            this.reconcileRecord(record, true),
          );
        }
        return success(
          `Reconciled ${records.length} temporary voice channels.`,
        );
      }
    }
  }

  private async handleChannelUpdated(
    signal: Extract<TempVoiceSignal, { kind: "CHANNEL_UPDATED" }>,
  ): Promise<TempVoiceResult<{ message: string }>> {
    const record = await this.repository.findByChannelId(signal.channelId);
    if (!record) return success("Channel is not managed by temp voice.");
    return this.leases.withLease(`aggregate:${record.id}`, async () => {
      if (signal.observedName && signal.observedName !== record.customName) {
        const updated = await this.writeCommandUpdate(record, {
          customName: signal.observedName,
        });
        await this.drainAggregateOutbox(updated.id);
        return success("Observed channel name adopted and reconciled.");
      }
      return this.reconcileRecord(record, true);
    });
  }

  private async handleVoiceStateObserved(
    signal: Extract<TempVoiceSignal, { kind: "VOICE_STATE_OBSERVED" }>,
  ): Promise<TempVoiceResult<{ message: string }>> {
    const sourceChannelId = signal.newChannelId;
    if (!sourceChannelId) return success("Voice state observed.");

    const config = await this.configService.getOrNull(signal.guildId);
    if (
      !config?.enabled ||
      !config.joinToCreateChannels.includes(sourceChannelId)
    ) {
      return success("Voice state observed.");
    }

    const creation = await this.leases.withLease(
      `member:${signal.guildId}:${signal.userId}`,
      () => this.createFromJoin(signal.guildId, signal.userId, sourceChannelId),
    );
    if (
      !creation.ok &&
      (creation.code === "CHANNEL_LIMIT" || creation.code === "COOLDOWN_ACTIVE")
    ) {
      await this.notifyBlockedJoinRequest(
        signal.guildId,
        signal.userId,
        creation.code,
        creation.message,
      );
    }
    return creation;
  }

  private async createFromJoin(
    guildId: string,
    actorId: string,
    sourceChannelId: string,
  ): Promise<TempVoiceResult<{ message: string }>> {
    const guild = container.client.guilds.cache.get(guildId);
    if (!guild)
      return failure(
        "GUILD_NOT_RESIDENT",
        "The guild is not available on this worker.",
        true,
      );

    const config = await this.configService.getOrNull(guildId);
    if (
      !config?.enabled ||
      !config.joinToCreateChannels.includes(sourceChannelId)
    ) {
      return failure(
        "INVALID_JOIN_CHANNEL",
        "This channel is not configured for temp voice.",
      );
    }

    const member = await guild.members.fetch(actorId).catch(() => null);
    if (
      !member ||
      member.user.bot ||
      member.voice.channelId !== sourceChannelId
    ) {
      return failure(
        "STALE_JOIN",
        "The user is no longer in the join-to-create channel.",
      );
    }

    let existing = await this.repository.findActiveByOwner(guildId, actorId);
    if (existing.length > 0) {
      const recovery = await this.recoverOwnedChannel(
        guild,
        member,
        sourceChannelId,
        existing,
      );
      if (recovery) return recovery;
      existing = await this.repository.findActiveByOwner(guildId, actorId);
    }

    if (existing.length >= config.maxChannelsPerUser) {
      return failure(
        "CHANNEL_LIMIT",
        "The temporary voice channel limit has been reached.",
      );
    }

    const cooldownKey = `${REDIS_KEYS.COOLDOWN}:${actorId}:${guildId}`;
    if (config.cooldownSeconds > 0) {
      try {
        if (await container.redis.get(cooldownKey)) {
          return failure(
            "COOLDOWN_ACTIVE",
            `Please wait ${config.cooldownSeconds} seconds before creating another channel.`,
            true,
          );
        }
      } catch (error) {
        container.logger.warn(
          `[TempVoiceCoordinator] Cooldown lookup failed for ${actorId}: ${this.errorMessage(error)}`,
        );
      }
    }

    const preferences = config.allowCustomization
      ? await this.userPreferences.get(guildId, actorId)
      : null;
    const channelCount = await this.prisma.tempVoiceChannel.count({
      where: { guildId, lifecycle: { not: TempVoiceLifecycle.DELETED } },
    });
    const channelName =
      preferences?.customName ||
      generateChannelName(
        config.defaultNameTemplate,
        member,
        channelCount + 1,
        config.namingScheme,
      );
    const operationId = randomUUID();
    const allowedUserIds = preferences?.allowedUserIds ?? [];
    const deniedUserIds = preferences?.deniedUserIds ?? [];
    const trustedUserIds = preferences?.trustedUserIds ?? [];
    const now = this.clock.now();
    const record = await this.repository.create({
      guildId,
      ownerId: actorId,
      operationId,
      createdByJoinChannelId: sourceChannelId,
      customName: channelName,
      customUserLimit: preferences?.customUserLimit ?? config.defaultUserLimit,
      customBitrate:
        preferences?.customBitrate ??
        (config.defaultBitrate === null ? null : config.defaultBitrate * 1_000),
      customRegion: preferences?.customRegion ?? config.defaultRegion ?? "auto",
      isLocked: preferences?.preferLocked ?? config.defaultLocked,
      isHidden: preferences?.preferHidden ?? config.defaultHidden,
      allowedUserIds,
      deniedUserIds,
      trustedUserIds,
      managedUserIds: unique([
        actorId,
        ...allowedUserIds,
        ...deniedUserIds,
        ...trustedUserIds,
      ]),
      now,
    });
    if (!record) {
      return failure(
        "CONFIG_DISABLED",
        "Temporary voice was disabled while the channel was being created.",
      );
    }
    if (config.cooldownSeconds > 0) {
      await container.redis
        .setex(cooldownKey, config.cooldownSeconds, "1")
        .catch((error: unknown) => {
          container.logger.warn(
            `[TempVoiceCoordinator] Cooldown write failed for ${actorId}: ${this.errorMessage(error)}`,
          );
        });
    }

    await this.leases.withLease(`aggregate:${record.id}`, async () => {
      const latest = await this.repository.findById(record.id);
      if (!latest) return;
      await this.ensureCreateEffectIfMissing(latest);
      await this.drainAggregateOutbox(latest.id);
    });
    return success("Temporary voice channel created.");
  }

  private async recoverOwnedChannel(
    guild: Guild,
    member: GuildMember,
    sourceChannelId: string,
    records: readonly TempVoiceRecord[],
  ): Promise<TempVoiceResult<{ message: string }> | null> {
    const recoveryCandidates = [...records].sort(
      (left, right) =>
        right.lastActiveAt.getTime() - left.lastActiveAt.getTime() ||
        right.createdAt.getTime() - left.createdAt.getTime(),
    );

    for (const record of recoveryCandidates) {
      if (!record.channelId) continue;

      const outcome = await this.leases.withLease(
        `aggregate:${record.id}`,
        async (): Promise<"MOVED" | "MISSING" | "STALE"> => {
          const latest = await this.repository.findById(record.id);
          if (
            !latest ||
            latest.lifecycle === TempVoiceLifecycleState.DELETED ||
            !latest.channelId
          ) {
            return "MISSING";
          }
          if (member.voice.channelId !== sourceChannelId) return "STALE";

          let channel;
          try {
            channel = await guild.channels.fetch(latest.channelId);
          } catch (error) {
            const classified = classifyDiscordError(error);
            if (!classified.isUnknownResource) throw error;
            await this.repository.markDeleted(latest.id, this.clock.now());
            return "MISSING";
          }
          if (!channel) {
            throw new Error(
              `Discord returned no channel for temp voice aggregate ${latest.id}`,
            );
          }
          if (!channel.isVoiceBased()) {
            await this.repository.markDeleted(latest.id, this.clock.now());
            return "MISSING";
          }

          await member.voice.setChannel(channel);
          return "MOVED";
        },
      );

      if (outcome === "MOVED") {
        return success("Moved to the existing temporary voice channel.");
      }
      if (outcome === "STALE") {
        return failure(
          "STALE_JOIN",
          "The user is no longer in the join-to-create channel.",
        );
      }
    }

    const pending = recoveryCandidates.find(
      (record) => record.lifecycle === TempVoiceLifecycleState.CREATING,
    );
    if (pending) {
      const resumed = await this.leases.withLease(
        `aggregate:${pending.id}`,
        async () => {
          const latest = await this.repository.findById(pending.id);
          if (!latest || latest.lifecycle === TempVoiceLifecycleState.DELETED) {
            return false;
          }
          if (member.voice.channelId !== sourceChannelId) return false;
          await this.ensureCreateEffectIfMissing(latest);
          await this.drainAggregateOutbox(latest.id);
          return true;
        },
      );
      if (resumed) {
        return success("Temporary voice channel creation resumed.");
      }
    }

    const unresolved = await this.repository.findActiveByOwner(
      guild.id,
      member.id,
    );
    if (unresolved.length > 0) {
      throw new Error(
        `Owned temp voice channel recovery is incomplete for ${member.id} in ${guild.id}`,
      );
    }
    return null;
  }

  private async notifyBlockedJoinRequest(
    guildId: string,
    userId: string,
    code: string,
    message: string,
  ): Promise<void> {
    const noticeKey = `${REDIS_KEYS.JOIN_NOTICE}:${guildId}:${userId}:${code}`;
    try {
      const acquired = await container.redis.set(
        noticeKey,
        "1",
        "EX",
        30,
        "NX",
      );
      if (acquired !== "OK") return;
    } catch (error) {
      container.logger.debug(
        `[TempVoiceCoordinator] Join notice deduplication unavailable: ${this.errorMessage(error)}`,
      );
    }

    const guild = container.client.guilds.cache.get(guildId);
    const member = await guild?.members.fetch(userId).catch(() => null);
    if (!member) return;
    const content =
      code === "COOLDOWN_ACTIVE"
        ? `Temporary voice channel creation is delayed: ${message} Stay in the creation channel and the bot will retry automatically.`
        : `Temporary voice channel not created: ${message}`;
    await member.send(content).catch(() => undefined);
  }

  private async ensureCreateEffect(record: TempVoiceRecord): Promise<void> {
    const updated = await this.repository.update(
      record.id,
      record.revision,
      { nextReconcileAt: this.clock.now() },
      [
        {
          kind: "CREATE_CHANNEL",
          dedupeKey: `${record.id}:create`,
          payload: { operationId: record.operationId },
        },
      ],
    );
    if (!updated) {
      throw new Error(
        `Failed to fence create effect for aggregate ${record.id}`,
      );
    }
  }

  private async executeChannelCommand(
    command: TempVoiceChannelCommand,
  ): Promise<TempVoiceResult<{ message: string }>> {
    let record = await this.repository.findByChannelId(command.channelId);
    if (!record || record.guildId !== command.guildId) {
      return failure(
        "CHANNEL_NOT_FOUND",
        "This temporary voice channel no longer exists.",
      );
    }
    if (
      record.lifecycle === TempVoiceLifecycleState.DELETED ||
      !record.channelId
    ) {
      return failure(
        "CHANNEL_NOT_ACTIVE",
        "This temporary voice channel is not active.",
      );
    }

    const guild = container.client.guilds.cache.get(command.guildId);
    if (!guild)
      return failure("GUILD_NOT_RESIDENT", "The guild is not available.", true);
    const config = await this.configService.getOrNull(command.guildId);
    if (!config || config.drainingAt) {
      return failure("CONFIG_NOT_FOUND", "Temporary voice is being removed.");
    }
    const actor = await guild.members.fetch(command.actorId).catch(() => null);
    if (!actor)
      return failure("MEMBER_NOT_FOUND", "The member could not be resolved.");
    const channel = await guild.channels
      .fetch(command.channelId)
      .catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      return failure(
        "CHANNEL_NOT_FOUND",
        "The voice channel could not be resolved.",
        true,
      );
    }

    if (
      command.kind === "CLAIM_OWNERSHIP" ||
      command.kind === "TRANSFER_OWNERSHIP"
    ) {
      const ownerIsPresent =
        hasCurrentTempVoiceOwner(record) && channel.members.has(record.ownerId);
      const graceIsDue =
        record.ownershipStatus === TempVoiceOwnershipState.OWNER_GRACE &&
        record.claimableAt !== null &&
        record.claimableAt.getTime() <= this.clock.now().getTime();
      if (ownerIsPresent || graceIsDue) {
        await this.reconcileRecord(record, false);
        const reconciled = await this.repository.findById(record.id);
        if (!reconciled) {
          return failure(
            "CHANNEL_NOT_FOUND",
            "This temporary voice channel no longer exists.",
          );
        }
        record = reconciled;
      }
    }

    if (command.kind === "CLAIM_OWNERSHIP") {
      return this.claimOwnership(command, record, actor, channel, config);
    }
    if (command.kind === "TRANSFER_OWNERSHIP") {
      return this.transferOwnership(command, record, actor, channel, config);
    }

    if (!this.canManage(actor, record, config)) {
      return failure(
        "FORBIDDEN",
        "You do not have permission to manage this channel.",
      );
    }
    if (!config.allowCustomization && command.kind !== "RECONCILE_CHANNEL") {
      return failure(
        "CUSTOMIZATION_DISABLED",
        "Channel customization is disabled.",
      );
    }

    if (command.kind === "RECONCILE_CHANNEL") {
      return this.reconcileRecord(record, true);
    }

    if (command.kind === "KICK_USERS") {
      const userIds = unique(
        command.userIds.filter(
          (userId) => !isCurrentTempVoiceOwner(record, userId),
        ),
      );
      if (userIds.length === 0)
        return failure("INVALID_TARGET", "The owner cannot be kicked.");
      const updated = await this.writeCommandUpdate(record, {}, [
        {
          kind: "DISCONNECT_USERS",
          dedupeKey: `${record.id}:${record.revision + 1}:kick`,
          payload: { userIds },
        },
      ]);
      await this.drainAggregateOutbox(updated.id);
      return success("Selected members were disconnected.");
    }

    const mutation = this.buildSettingsMutation(command, record, config);
    if (!mutation.ok) return mutation;
    const updated = await this.writeCommandUpdate(record, mutation.data.update);
    await this.drainAggregateOutbox(updated.id);
    await this.persistPreference(command, updated, config);
    return success(mutation.data.message);
  }

  private buildSettingsMutation(
    command: Exclude<
      TempVoiceChannelCommand,
      { kind: "CLAIM_OWNERSHIP" | "TRANSFER_OWNERSHIP" }
    >,
    record: TempVoiceRecord,
    config: TempVoiceConfig,
  ):
    | {
        readonly ok: true;
        readonly data: { update: TempVoiceRecordUpdate; message: string };
      }
    | {
        readonly ok: false;
        readonly code: string;
        readonly message: string;
        readonly retryable: boolean;
      } {
    switch (command.kind) {
      case "TOGGLE_LOCK":
        return {
          ok: true,
          data: {
            update: { isLocked: !record.isLocked },
            message: record.isLocked ? "Channel unlocked." : "Channel locked.",
          },
        };
      case "TOGGLE_HIDE":
        return {
          ok: true,
          data: {
            update: { isHidden: !record.isHidden },
            message: record.isHidden ? "Channel visible." : "Channel hidden.",
          },
        };
      case "RENAME_CHANNEL": {
        const name = command.name.trim();
        if (name.length < 1 || name.length > 100) {
          return failure(
            "INVALID_NAME",
            "Channel names must contain between 1 and 100 characters.",
          );
        }
        return {
          ok: true,
          data: { update: { customName: name }, message: "Channel renamed." },
        };
      }
      case "SET_USER_LIMIT":
        if (command.value < 0 || command.value > 99) {
          return failure(
            "INVALID_LIMIT",
            "User limit must be between 0 and 99.",
          );
        }
        return {
          ok: true,
          data: {
            update: { customUserLimit: command.value },
            message:
              command.value === 0
                ? "User limit removed."
                : `User limit set to ${command.value}.`,
          },
        };
      case "SET_BITRATE": {
        const bitrate = command.value * 1_000;
        const guild = container.client.guilds.cache.get(command.guildId);
        if (command.value < 8 || !guild || bitrate > guild.maximumBitrate) {
          return failure(
            "INVALID_BITRATE",
            `Bitrate must be between 8 and ${Math.floor((guild?.maximumBitrate ?? 96_000) / 1_000)} kbps.`,
          );
        }
        return {
          ok: true,
          data: {
            update: { customBitrate: bitrate },
            message: `Bitrate set to ${command.value} kbps.`,
          },
        };
      }
      case "SET_REGION":
        if (
          !VOICE_REGIONS.includes(
            command.region as (typeof VOICE_REGIONS)[number],
          )
        ) {
          return failure(
            "INVALID_REGION",
            "The selected voice region is invalid.",
          );
        }
        return {
          ok: true,
          data: {
            update: { customRegion: command.region },
            message: `Region set to ${command.region}.`,
          },
        };
      case "PERMIT_USERS": {
        const userIds = unique(
          command.userIds.filter(
            (userId) => !isCurrentTempVoiceOwner(record, userId),
          ),
        );
        return {
          ok: true,
          data: {
            update: {
              allowedUserIds: unique([...record.allowedUserIds, ...userIds]),
              deniedUserIds: record.deniedUserIds.filter(
                (userId) => !userIds.includes(userId),
              ),
            },
            message: `Permitted ${userIds.map((userId) => `<@${userId}>`).join(", ")}.`,
          },
        };
      }
      case "DENY_USERS": {
        const userIds = unique(
          command.userIds.filter(
            (userId) => !isCurrentTempVoiceOwner(record, userId),
          ),
        );
        if (userIds.length === 0)
          return failure("INVALID_TARGET", "The owner cannot be denied.");
        return {
          ok: true,
          data: {
            update: {
              deniedUserIds: unique([...record.deniedUserIds, ...userIds]),
              allowedUserIds: record.allowedUserIds.filter(
                (userId) => !userIds.includes(userId),
              ),
              trustedUserIds: record.trustedUserIds.filter(
                (userId) => !userIds.includes(userId),
              ),
            },
            message: `Denied ${userIds.map((userId) => `<@${userId}>`).join(", ")}.`,
          },
        };
      }
      case "TOGGLE_TRUST": {
        const userIds = unique(
          command.userIds.filter(
            (userId) => !isCurrentTempVoiceOwner(record, userId),
          ),
        );
        const added = userIds.filter(
          (userId) => !record.trustedUserIds.includes(userId),
        );
        const removed = userIds.filter((userId) =>
          record.trustedUserIds.includes(userId),
        );
        return {
          ok: true,
          data: {
            update: {
              trustedUserIds: unique([
                ...record.trustedUserIds.filter(
                  (userId) => !removed.includes(userId),
                ),
                ...added,
              ]),
              allowedUserIds: unique([...record.allowedUserIds, ...added]),
              deniedUserIds: record.deniedUserIds.filter(
                (userId) => !added.includes(userId),
              ),
            },
            message: "Trust settings updated.",
          },
        };
      }
      case "RESET_SETTINGS":
        return {
          ok: true,
          data: {
            update: {
              customUserLimit: config.defaultUserLimit,
              customBitrate:
                config.defaultBitrate === null
                  ? null
                  : config.defaultBitrate * 1_000,
              customRegion: config.defaultRegion ?? "auto",
              isLocked: config.defaultLocked,
              isHidden: config.defaultHidden,
              allowedUserIds: [],
              deniedUserIds: [],
              trustedUserIds: [],
            },
            message: "Channel settings reset.",
          },
        };
      case "RECONCILE_CHANNEL":
        return {
          ok: true,
          data: { update: {}, message: "Channel reconciled." },
        };
      case "KICK_USERS":
        return failure("INVALID_COMMAND", "Kick is handled separately.");
    }
  }

  private async transferOwnership(
    command: Extract<TempVoiceChannelCommand, { kind: "TRANSFER_OWNERSHIP" }>,
    record: TempVoiceRecord,
    actor: GuildMember,
    channel: VoiceChannel,
    config: TempVoiceConfig,
  ): Promise<TempVoiceResult<{ message: string }>> {
    if (!this.canTransfer(actor, record, config)) {
      return failure(
        "FORBIDDEN",
        "Only the owner or a server administrator can transfer ownership.",
      );
    }
    if (
      command.expectedOwnershipEpoch !== undefined &&
      command.expectedOwnershipEpoch !== record.ownershipEpoch
    ) {
      return failure(
        "STALE_OWNERSHIP",
        "This ownership prompt is no longer active.",
      );
    }
    const target = channel.members.get(command.targetUserId);
    if (!target || target.user.bot) {
      return failure(
        "INVALID_TARGET",
        "The new owner must be a human member inside the channel.",
      );
    }
    if (isCurrentTempVoiceOwner(record, command.targetUserId)) {
      return failure("INVALID_TARGET", "This member is already the owner.");
    }
    const targetOwnedCount = await this.repository.countActiveByOwner(
      record.guildId,
      command.targetUserId,
    );
    if (targetOwnedCount >= config.maxChannelsPerUser) {
      return failure(
        "OWNER_CHANNEL_LIMIT",
        "The selected member already owns the maximum number of temporary voice channels.",
      );
    }
    const transition = this.policy.transferOwnership(
      record,
      asTempVoiceUserId(command.targetUserId),
      "OWNERSHIP_TRANSFERRED",
    );
    if (!transition.changed)
      return failure("INVALID_TARGET", "This member is already the owner.");
    const updated = await this.writeCommandUpdate(record, {
      ...transition.patch,
      allowedUserIds: record.allowedUserIds.filter(
        (userId) => userId !== command.targetUserId,
      ),
      deniedUserIds: record.deniedUserIds.filter(
        (userId) => userId !== command.targetUserId,
      ),
      trustedUserIds: record.trustedUserIds.filter(
        (userId) => userId !== command.targetUserId,
      ),
      managedUserIds: unique([
        ...record.managedUserIds,
        record.ownerId,
        command.targetUserId,
      ]),
    });
    await this.drainAggregateOutbox(updated.id);
    return success(`Ownership transferred to <@${command.targetUserId}>.`);
  }

  private async claimOwnership(
    command: Extract<TempVoiceChannelCommand, { kind: "CLAIM_OWNERSHIP" }>,
    record: TempVoiceRecord,
    actor: GuildMember,
    channel: VoiceChannel,
    config: TempVoiceConfig,
  ): Promise<TempVoiceResult<{ message: string }>> {
    if (actor.user.bot || actor.voice.channelId !== channel.id) {
      return failure(
        "NOT_IN_CHANNEL",
        "You must be inside the channel to claim it.",
      );
    }
    if (
      command.expectedOwnershipEpoch !== undefined &&
      command.expectedOwnershipEpoch !== record.ownershipEpoch
    ) {
      return failure(
        "STALE_OWNERSHIP",
        "This claim prompt is no longer active.",
      );
    }
    if (record.ownershipStatus !== TempVoiceOwnershipState.CLAIMABLE) {
      return failure(
        "NOT_CLAIMABLE",
        "This channel is still inside the owner grace period.",
      );
    }
    const actorOwnedCount = await this.repository.countActiveByOwner(
      record.guildId,
      actor.id,
    );
    if (actorOwnedCount >= config.maxChannelsPerUser) {
      return failure(
        "OWNER_CHANNEL_LIMIT",
        "You already own the maximum number of temporary voice channels.",
      );
    }
    const transition = this.policy.transferOwnership(
      record,
      asTempVoiceUserId(actor.id),
      "OWNERSHIP_CLAIMED",
    );
    const updated = await this.writeCommandUpdate(record, {
      ...transition.patch,
      allowedUserIds: record.allowedUserIds.filter(
        (userId) => userId !== actor.id,
      ),
      deniedUserIds: record.deniedUserIds.filter(
        (userId) => userId !== actor.id,
      ),
      trustedUserIds: record.trustedUserIds.filter(
        (userId) => userId !== actor.id,
      ),
      managedUserIds: unique([
        ...record.managedUserIds,
        record.ownerId,
        actor.id,
      ]),
    });
    await this.drainAggregateOutbox(updated.id);
    return success("You are now the owner of this channel.");
  }

  private async writeCommandUpdate(
    record: TempVoiceRecord,
    update: TempVoiceRecordUpdate,
    additionalEffects: readonly TempVoiceOutboxWrite[] = [],
  ): Promise<TempVoiceRecord> {
    const now = this.clock.now();
    const revision = record.revision + 1;
    const updated = await this.repository.update(
      record.id,
      record.revision,
      {
        ...update,
        nextReconcileAt: new Date(now.getTime() + DEEP_RECONCILE_INTERVAL_MS),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      [
        ...additionalEffects,
        {
          kind: "RECONCILE_CHANNEL",
          dedupeKey: `${record.id}:${revision}:reconcile`,
        },
      ],
    );
    if (!updated) throw new Error(`Stale temp voice revision for ${record.id}`);
    return updated;
  }

  private async reconcileRecord(
    initialRecord: TempVoiceRecord,
    forceMessageFetch: boolean,
  ): Promise<TempVoiceResult<{ message: string }>> {
    let record =
      (await this.repository.findById(initialRecord.id)) ?? initialRecord;
    if (record.lifecycle === TempVoiceLifecycleState.DELETED) {
      return success("Deleted aggregate skipped.");
    }

    if (!record.channelId) {
      await this.ensureCreateEffectIfMissing(record);
      await this.drainAggregateOutbox(record.id);
      return success("Channel creation reconciled.");
    }

    const guild = container.client.guilds.cache.get(record.guildId);
    if (!guild) {
      await this.deferRecord(
        record,
        "GUILD_NOT_RESIDENT",
        "Guild is not resident on this worker.",
      );
      return failure(
        "GUILD_NOT_RESIDENT",
        "Guild is not resident on this worker.",
        true,
      );
    }

    let channel: VoiceChannel;
    try {
      const fetched = await guild.channels.fetch(record.channelId);
      if (!fetched || fetched.type !== ChannelType.GuildVoice) {
        throw new Error("Managed channel is not a guild voice channel.");
      }
      channel = fetched;
    } catch (error) {
      const classified = classifyDiscordError(error);
      if (classified.isUnknownResource) {
        await this.repository.markDeleted(record.id, this.clock.now());
        return success("Missing Discord channel finalized as deleted.");
      }
      await this.deferRecord(record, classified.code, classified.message);
      throw error;
    }

    const config = await this.configService.getOrNull(record.guildId);
    if (!config) {
      await this.deferRecord(
        record,
        "CONFIG_NOT_FOUND",
        "Temp voice configuration is missing.",
      );
      return failure(
        "CONFIG_NOT_FOUND",
        "Temp voice configuration is missing.",
        true,
      );
    }
    if (config.drainingAt) {
      await this.drainAggregateOutbox(record.id);
      return success("Configuration drain is already scheduled.");
    }

    const now = this.clock.now();
    const humanMembers = channel.members.filter((member) => !member.user.bot);
    if (
      humanMembers.size === 0 &&
      record.deleteAfter &&
      now.getTime() >= record.deleteAfter.getTime()
    ) {
      const deleting = await this.repository.update(
        record.id,
        record.revision,
        {
          lifecycle: TempVoiceLifecycleState.DELETING,
          nextReconcileAt: now,
        },
        [
          {
            kind: "DELETE_CHANNEL",
            dedupeKey: `${record.id}:${record.ownershipEpoch}:${record.deleteAfter.getTime()}:delete`,
          },
        ],
      );
      if (!deleting)
        throw new Error(`Stale delete transition for ${record.id}`);
      await this.drainAggregateOutbox(record.id);
      return success("Empty channel deletion reconciled.");
    }

    const transition = this.policy.observePresence(record, {
      now,
      ownerPresent:
        hasCurrentTempVoiceOwner(record) && humanMembers.has(record.ownerId),
      eligibleHumanCount: humanMembers.size,
      emptyDeleteDelayMs: config.deleteDelaySeconds * 1_000,
    });
    const nextRevision = record.revision + 1;
    const effects: TempVoiceOutboxWrite[] = [
      {
        kind: "RECONCILE_CHANNEL",
        dedupeKey: `${record.id}:${nextRevision}:reconcile`,
        payload: { forceMessageFetch },
      },
    ];
    const statePatch = transition.patch;
    const nextClaimableAt =
      "claimableAt" in statePatch ? statePatch.claimableAt : record.claimableAt;
    const nextDeleteAfter =
      "deleteAfter" in statePatch ? statePatch.deleteAfter : record.deleteAfter;

    if (transition.ownership === "OWNER_LEFT" && nextClaimableAt) {
      effects.push({
        kind: "RECONCILE_CHANNEL",
        dedupeKey: `${record.id}:${statePatch.ownershipEpoch ?? record.ownershipEpoch}:ownership-deadline`,
        payload: {
          expectedOwnershipEpoch:
            statePatch.ownershipEpoch ?? record.ownershipEpoch,
          reconcileState: true,
        },
        availableAt: nextClaimableAt,
      });
    }
    if (transition.occupancy === "BECAME_EMPTY" && nextDeleteAfter) {
      effects.push({
        kind: "DELETE_CHANNEL",
        dedupeKey: `${record.id}:${nextDeleteAfter.getTime()}:delete`,
        availableAt: nextDeleteAfter,
      });
    }

    const deadlines = [nextClaimableAt, nextDeleteAfter].filter(
      (date): date is Date =>
        date instanceof Date && date.getTime() > now.getTime(),
    );
    const nextReconcileAt =
      deadlines.sort((left, right) => left.getTime() - right.getTime())[0] ??
      new Date(now.getTime() + DEEP_RECONCILE_INTERVAL_MS);

    const updated = await this.repository.update(
      record.id,
      record.revision,
      {
        ...(statePatch as TempVoiceRecordUpdate),
        ...(humanMembers.size > 0 && { lastActiveAt: now }),
        lastReconciledAt: now,
        nextReconcileAt,
        failureCount: 0,
        lastErrorCode: null,
        lastErrorMessage: null,
      } as TempVoiceRecordUpdate,
      effects,
    );
    if (!updated)
      throw new Error(`Stale reconciliation transition for ${record.id}`);
    record = updated;
    await this.drainAggregateOutbox(record.id);
    return success(
      `Channel reconciled: occupancy=${transition.occupancy}, ownership=${transition.ownership}.`,
    );
  }

  private async ensureCreateEffectIfMissing(
    record: TempVoiceRecord,
  ): Promise<void> {
    const existing = await this.prisma.tempVoiceOutbox.findUnique({
      where: { dedupeKey: `${record.id}:create` },
    });
    if (!existing) await this.ensureCreateEffect(record);
  }

  public async processOutbox(
    outboxId: string,
  ): Promise<TempVoiceResult<{ message: string }>> {
    const observed = await this.prisma.tempVoiceOutbox.findUnique({
      where: { id: outboxId },
    });
    if (!observed || observed.status === TempVoiceOutboxStatus.COMPLETED) {
      return success("Outbox effect already completed.");
    }
    if (observed.availableAt.getTime() > this.clock.now().getTime()) {
      return success("Outbox effect is not due yet.");
    }

    return this.leases.withLease(
      `aggregate:${observed.aggregateId}`,
      async () => {
        const outbox = await this.prisma.tempVoiceOutbox.findUnique({
          where: { id: outboxId },
        });
        if (!outbox || outbox.status === TempVoiceOutboxStatus.COMPLETED) {
          return success("Outbox effect already completed.");
        }
        if (outbox.availableAt.getTime() > this.clock.now().getTime()) {
          return success("Outbox effect is not due yet.");
        }
        await this.prisma.tempVoiceOutbox.update({
          where: { id: outbox.id },
          data: {
            status: TempVoiceOutboxStatus.PROCESSING,
            attempts: { increment: 1 },
          },
        });
        try {
          await this.executeOutboxEffect(outbox);
          await this.prisma.tempVoiceOutbox.update({
            where: { id: outbox.id },
            data: {
              status: TempVoiceOutboxStatus.COMPLETED,
              completedAt: this.clock.now(),
              lastError: null,
            },
          });
          return success(`Outbox effect ${outbox.kind} completed.`);
        } catch (error) {
          const attempt = outbox.attempts + 1;
          const delayMs = Math.min(
            300_000,
            2_000 * 2 ** Math.min(attempt - 1, 7),
          );
          const jitterMs = Math.floor(Math.random() * 1_000);
          await this.prisma.tempVoiceOutbox.update({
            where: { id: outbox.id },
            data: {
              status: TempVoiceOutboxStatus.FAILED,
              availableAt: new Date(
                this.clock.now().getTime() + delayMs + jitterMs,
              ),
              lastError: this.errorMessage(error),
            },
          });
          throw error;
        }
      },
    );
  }

  private async executeOutboxEffect(outbox: TempVoiceOutbox): Promise<void> {
    const record = await this.repository.findById(outbox.aggregateId);
    if (!record || record.lifecycle === TempVoiceLifecycleState.DELETED) return;
    const payload = this.payload(outbox);
    switch (outbox.kind) {
      case TempVoiceEffectKind.CREATE_CHANNEL:
        await this.createDiscordChannel(record);
        return;
      case TempVoiceEffectKind.MOVE_OWNER:
        await this.moveOwner(record, payload);
        return;
      case TempVoiceEffectKind.DISCONNECT_USERS:
        await this.disconnectUsers(record, payload);
        return;
      case TempVoiceEffectKind.DELETE_CHANNEL:
        await this.deleteDiscordChannel(record, payload.force === true);
        return;
      case TempVoiceEffectKind.RECONCILE_CHANNEL:
      case TempVoiceEffectKind.RECONCILE_PERMISSIONS:
      case TempVoiceEffectKind.RECONCILE_PANEL:
      case TempVoiceEffectKind.DELIVER_OWNERSHIP_NOTICE:
      case TempVoiceEffectKind.DELIVER_OWNER_DM:
        if (
          typeof payload.expectedOwnershipEpoch === "number" &&
          payload.expectedOwnershipEpoch !== record.ownershipEpoch
        ) {
          return;
        }
        if (payload.reconcileState === true) {
          await this.reconcileRecord(record, true);
          return;
        }
        await this.projectRecord(record, payload.forceMessageFetch === true);
        return;
    }
  }

  private async createDiscordChannel(record: TempVoiceRecord): Promise<void> {
    if (record.channelId) return;
    const guild = container.client.guilds.cache.get(record.guildId);
    if (!guild) throw new Error(`Guild ${record.guildId} is not resident`);
    const adopted = await this.findCreatedChannel(guild, record.operationId);
    const config = await this.prisma.tempVoiceConfig.findUnique({
      where: { guildId: record.guildId },
      select: { enabled: true, drainingAt: true },
    });
    if (!config?.enabled || config.drainingAt) {
      if (adopted) {
        await adopted.delete(`tempvoice:cancel-create:${record.operationId}`);
      }
      await this.repository.markDeleted(record.id, this.clock.now());
      return;
    }
    const channel =
      adopted ?? (await this.createNewDiscordChannel(guild, record));
    const revision = record.revision + 1;
    const updated = await this.repository.update(
      record.id,
      record.revision,
      {
        channelId: channel.id,
        lifecycle: TempVoiceLifecycleState.ACTIVE,
        nextReconcileAt: this.clock.now(),
      },
      [
        {
          kind: "MOVE_OWNER",
          dedupeKey: `${record.id}:${revision}:move-owner`,
          payload: {
            userId: record.ownerId,
            sourceChannelId: record.createdByJoinChannelId,
          },
        },
        {
          kind: "RECONCILE_CHANNEL",
          dedupeKey: `${record.id}:${revision}:reconcile`,
        },
      ],
    );
    if (!updated) {
      const latest = await this.repository.findById(record.id);
      if (
        latest &&
        !latest.channelId &&
        (latest.lifecycle === TempVoiceLifecycleState.DELETING ||
          latest.lifecycle === TempVoiceLifecycleState.DELETE_PENDING ||
          latest.lifecycle === TempVoiceLifecycleState.DELETE_FAILED)
      ) {
        const now = this.clock.now();
        const linked = await this.repository.update(
          latest.id,
          latest.revision,
          {
            channelId: channel.id,
            lifecycle: TempVoiceLifecycleState.DELETING,
            deleteAfter: now,
            nextReconcileAt: now,
          },
          [
            {
              kind: "DELETE_CHANNEL",
              dedupeKey: `${latest.id}:${latest.revision + 1}:stale-create-cleanup`,
              payload: { force: true },
            },
          ],
        );
        if (linked) return;
      }
      throw new Error(`Stale create completion for ${record.id}`);
    }
  }

  private async findCreatedChannel(
    guild: Guild,
    operationId: string,
  ): Promise<VoiceChannel | null> {
    try {
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelCreate,
        limit: 50,
      });
      const entry = auditLogs.entries.find(
        (candidate) =>
          candidate.executorId === container.client.user?.id &&
          candidate.reason === `tempvoice:create:${operationId}`,
      );
      const targetId = entry?.targetId;
      if (!targetId) return null;
      const channel = await guild.channels.fetch(targetId);
      return channel?.type === ChannelType.GuildVoice ? channel : null;
    } catch (error) {
      container.logger.warn(
        `[TempVoiceCoordinator] Could not inspect create audit logs for ${operationId}: ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  private async createNewDiscordChannel(
    guild: Guild,
    record: TempVoiceRecord,
  ): Promise<VoiceChannel> {
    const config = await this.configService.getOrNull(record.guildId);
    if (!config || config.drainingAt) {
      throw new Error(
        `Temp voice configuration ${record.guildId} is unavailable`,
      );
    }
    const categoryResult = await findSuitableCategory(
      guild,
      config.categoryId,
      config.fallbackCategoryId,
    );
    if (!categoryResult.category && categoryResult.strategy === "none") {
      throw new Error(
        "No suitable category is available for temporary voice channels",
      );
    }

    const permissionOverwrites: OverwriteResolvable[] = categoryResult.category
      ? categoryResult.category.permissionOverwrites.cache.map((overwrite) => ({
          id: overwrite.id,
          allow: overwrite.allow.toArray(),
          deny: overwrite.deny.toArray(),
          type: overwrite.type,
        }))
      : [];
    permissionOverwrites.push({
      id: record.ownerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.Stream,
        PermissionFlagsBits.UseVAD,
      ],
    });

    return guild.channels.create({
      name: record.customName ?? "Temporary Voice",
      type: ChannelType.GuildVoice,
      parent: categoryResult.category?.id ?? null,
      userLimit: record.customUserLimit ?? 0,
      bitrate:
        record.customBitrate === null
          ? undefined
          : Math.min(record.customBitrate, guild.maximumBitrate),
      rtcRegion:
        record.customRegion && record.customRegion !== "auto"
          ? record.customRegion
          : undefined,
      permissionOverwrites,
      reason: `tempvoice:create:${record.operationId}`,
    });
  }

  private async moveOwner(
    record: TempVoiceRecord,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    if (!record.channelId) return;
    const guild = container.client.guilds.cache.get(record.guildId);
    if (!guild) throw new Error(`Guild ${record.guildId} is not resident`);
    const userId =
      typeof payload.userId === "string" ? payload.userId : record.ownerId;
    const sourceChannelId =
      typeof payload.sourceChannelId === "string"
        ? payload.sourceChannelId
        : record.createdByJoinChannelId;
    const member = await guild.members.fetch(userId);
    if (member.voice.channelId !== sourceChannelId) return;
    await member.voice.setChannel(record.channelId);
  }

  private async disconnectUsers(
    record: TempVoiceRecord,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    if (!record.channelId) return;
    const guild = container.client.guilds.cache.get(record.guildId);
    if (!guild) throw new Error(`Guild ${record.guildId} is not resident`);
    const userIds = Array.isArray(payload.userIds)
      ? payload.userIds.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    for (const userId of userIds) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member?.voice.channelId === record.channelId) {
        await member.voice.disconnect("Removed from temporary voice channel");
      }
    }
  }

  private async projectRecord(
    record: TempVoiceRecord,
    forceMessageFetch: boolean,
  ): Promise<void> {
    if (!record.channelId) return;
    const guild = container.client.guilds.cache.get(record.guildId);
    if (!guild) throw new Error(`Guild ${record.guildId} is not resident`);
    let fetched;
    try {
      fetched = await guild.channels.fetch(record.channelId);
    } catch (error) {
      const classified = classifyDiscordError(error);
      if (classified.isUnknownResource) {
        await this.repository.markDeleted(record.id, this.clock.now());
        return;
      }
      throw error;
    }
    if (!fetched || fetched.type !== ChannelType.GuildVoice) return;
    const config = await this.configService.getOrNull(record.guildId);
    if (!config || config.drainingAt) return;
    await this.projector.reconcile(record, fetched, {
      controlPanelEnabled: config.controlPanelEnabled,
      forceMessageFetch,
    });
  }

  private async deleteDiscordChannel(
    record: TempVoiceRecord,
    force: boolean,
  ): Promise<void> {
    if (!record.channelId) {
      if (force) await this.repository.markDeleted(record.id, this.clock.now());
      return;
    }
    if (!force && !record.deleteAfter) return;
    const now = this.clock.now();
    const latest = await this.repository.findById(record.id);
    if (
      !latest ||
      latest.lifecycle === TempVoiceLifecycleState.DELETED ||
      !latest.channelId ||
      (!force && !latest.deleteAfter) ||
      (!force &&
        latest.deleteAfter &&
        latest.deleteAfter.getTime() > now.getTime())
    ) {
      return;
    }
    const guild = container.client.guilds.cache.get(latest.guildId);
    if (!guild) throw new Error(`Guild ${latest.guildId} is not resident`);

    try {
      const channel = await guild.channels.fetch(latest.channelId);
      if (!channel) return;
      if (!channel.isVoiceBased()) {
        await this.repository.markDeleted(latest.id, now);
        return;
      }
      const humanMembers = channel.members.filter((member) => !member.user.bot);
      if (!force && humanMembers.size > 0) {
        await this.repository.update(latest.id, latest.revision, {
          lifecycle: TempVoiceLifecycleState.ACTIVE,
          emptySince: null,
          deleteAfter: null,
          nextReconcileAt: new Date(now.getTime() + DEEP_RECONCILE_INTERVAL_MS),
        });
        return;
      }
      await channel.delete(`tempvoice:delete:${latest.operationId}`);
      await this.repository.markDeleted(latest.id, now);
    } catch (error) {
      const classified = classifyDiscordError(error);
      if (classified.isUnknownResource) {
        await this.repository.markDeleted(latest.id, now);
        return;
      }
      const retryAt = new Date(
        now.getTime() +
          (classified.isMissingPermissions
            ? MISSING_PERMISSION_RETRY_MS
            : 30_000),
      );
      await this.repository.update(latest.id, latest.revision, {
        lifecycle: TempVoiceLifecycleState.DELETE_FAILED,
        nextReconcileAt: retryAt,
        failureCount: latest.failureCount + 1,
        lastErrorCode: classified.code,
        lastErrorMessage: classified.message.slice(0, MAX_ERROR_MESSAGE_LENGTH),
      });
      throw error;
    }
  }

  private async drainAggregateOutbox(aggregateId: string): Promise<void> {
    for (;;) {
      const outbox = await this.prisma.tempVoiceOutbox.findFirst({
        where: {
          aggregateId,
          status: {
            in: [TempVoiceOutboxStatus.PENDING, TempVoiceOutboxStatus.FAILED],
          },
          availableAt: { lte: this.clock.now() },
        },
        orderBy: { createdAt: "asc" },
      });
      if (!outbox) return;
      const result = await this.processOutboxWithoutLease(outbox);
      if (!result.ok && result.retryable) return;
    }
  }

  private async processOutboxWithoutLease(
    outbox: TempVoiceOutbox,
  ): Promise<TempVoiceResult<{ message: string }>> {
    await this.prisma.tempVoiceOutbox.update({
      where: { id: outbox.id },
      data: {
        status: TempVoiceOutboxStatus.PROCESSING,
        attempts: { increment: 1 },
      },
    });
    try {
      await this.executeOutboxEffect(outbox);
      await this.prisma.tempVoiceOutbox.update({
        where: { id: outbox.id },
        data: {
          status: TempVoiceOutboxStatus.COMPLETED,
          completedAt: this.clock.now(),
          lastError: null,
        },
      });
      return success(`Outbox effect ${outbox.kind} completed.`);
    } catch (error) {
      const delayMs = Math.min(
        300_000,
        2_000 * 2 ** Math.min(outbox.attempts, 7),
      );
      await this.prisma.tempVoiceOutbox.update({
        where: { id: outbox.id },
        data: {
          status: TempVoiceOutboxStatus.FAILED,
          availableAt: new Date(this.clock.now().getTime() + delayMs),
          lastError: this.errorMessage(error),
        },
      });
      return failure("OUTBOX_FAILED", this.errorMessage(error), true);
    }
  }

  private async deferRecord(
    record: TempVoiceRecord,
    code: string,
    message: string,
  ): Promise<void> {
    await this.repository.update(record.id, record.revision, {
      nextReconcileAt: new Date(this.clock.now().getTime() + 30_000),
      failureCount: record.failureCount + 1,
      lastErrorCode: code,
      lastErrorMessage: message.slice(0, MAX_ERROR_MESSAGE_LENGTH),
    });
  }

  private async persistPreference(
    command: TempVoiceChannelCommand,
    record: TempVoiceRecord,
    config: TempVoiceConfig,
  ): Promise<void> {
    if (
      !config.allowCustomization ||
      command.kind === "RECONCILE_CHANNEL" ||
      !hasCurrentTempVoiceOwner(record)
    )
      return;
    await this.userPreferences
      .save(record.guildId, record.ownerId, {
        customName: record.customName,
        customUserLimit: record.customUserLimit,
        customBitrate: record.customBitrate,
        customRegion: record.customRegion,
        preferLocked: record.isLocked,
        preferHidden: record.isHidden,
        allowedUserIds: [...record.allowedUserIds],
        deniedUserIds: [...record.deniedUserIds],
        trustedUserIds: [...record.trustedUserIds],
      })
      .catch((error: unknown) => {
        container.logger.warn(
          `[TempVoiceCoordinator] Could not save preferences for ${record.ownerId}: ${this.errorMessage(error)}`,
        );
      });
  }

  private canManage(
    member: GuildMember,
    record: TempVoiceRecord,
    config: TempVoiceConfig,
  ): boolean {
    return (
      isCurrentTempVoiceOwner(record, member.id) ||
      record.trustedUserIds.includes(member.id) ||
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      config.adminRoleIds.some((roleId) => member.roles.cache.has(roleId))
    );
  }

  private canTransfer(
    member: GuildMember,
    record: TempVoiceRecord,
    config: TempVoiceConfig,
  ): boolean {
    return (
      isCurrentTempVoiceOwner(record, member.id) ||
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      config.adminRoleIds.some((roleId) => member.roles.cache.has(roleId))
    );
  }

  private payload(outbox: TempVoiceOutbox): Readonly<Record<string, unknown>> {
    return outbox.payload &&
      typeof outbox.payload === "object" &&
      !Array.isArray(outbox.payload)
      ? (outbox.payload as Prisma.JsonObject)
      : {};
  }

  private errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.slice(0, MAX_ERROR_MESSAGE_LENGTH);
  }
}
