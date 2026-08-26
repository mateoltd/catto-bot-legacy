import {
  Prisma,
  TempVoiceLifecycle,
  TempVoiceOwnershipStatus,
  type PrismaClient,
  type TempVoiceChannel,
} from "@prisma/client";

import {
  asTempVoiceAggregateId,
  asTempVoiceChannelId,
  asTempVoiceGuildId,
  asTempVoiceUserId,
  TempVoiceLifecycleState,
  TempVoiceOwnershipState,
} from "../domain/temp-voice.types.js";
import type { TempVoiceRecord } from "../domain/temp-voice.types.js";
import type {
  TempVoiceCreateRecord,
  TempVoiceOutboxWrite,
  TempVoiceRecordUpdate,
  TempVoiceRepository,
} from "../ports/temp-voice-repository.port.js";

const stringArray = (value: Prisma.JsonValue): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const jsonArray = (value: readonly string[]): Prisma.InputJsonValue => [
  ...value,
];

export class PrismaTempVoiceRepository implements TempVoiceRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public create(
    record: TempVoiceCreateRecord,
  ): Promise<TempVoiceRecord | null> {
    return this.prisma.$transaction(async (transaction) => {
      const configs = await transaction.$queryRaw<
        Array<{ enabled: boolean; drainingAt: Date | null }>
      >(Prisma.sql`
        SELECT "enabled", "drainingAt"
        FROM "temp_voice_configs"
        WHERE "guildId" = ${record.guildId}
        FOR SHARE
      `);
      const config = configs[0];
      if (!config?.enabled || config.drainingAt) return null;

      const created = await transaction.tempVoiceChannel.create({
        data: {
          guildId: record.guildId,
          ownerId: record.ownerId,
          operationId: record.operationId,
          createdByJoinChannelId: record.createdByJoinChannelId,
          customName: record.customName,
          customUserLimit: record.customUserLimit,
          customBitrate: record.customBitrate,
          customRegion: record.customRegion,
          isLocked: record.isLocked,
          isHidden: record.isHidden,
          allowedUserIds: jsonArray(record.allowedUserIds),
          deniedUserIds: jsonArray(record.deniedUserIds),
          trustedUserIds: jsonArray(record.trustedUserIds),
          managedUserIds: jsonArray(record.managedUserIds ?? []),
          nextReconcileAt: record.now,
          lastActiveAt: record.now,
        },
      });

      return this.map(created);
    });
  }

  public async findById(aggregateId: string): Promise<TempVoiceRecord | null> {
    const record = await this.prisma.tempVoiceChannel.findUnique({
      where: { id: aggregateId },
    });
    return record ? this.map(record) : null;
  }

  public async findByChannelId(
    channelId: string,
  ): Promise<TempVoiceRecord | null> {
    const record = await this.prisma.tempVoiceChannel.findUnique({
      where: { channelId },
    });
    return record ? this.map(record) : null;
  }

  public async findActiveByOwner(
    guildId: string,
    ownerId: string,
  ): Promise<TempVoiceRecord[]> {
    const records = await this.prisma.tempVoiceChannel.findMany({
      where: {
        guildId,
        ownerId,
        lifecycle: { not: TempVoiceLifecycle.DELETED },
        ownershipStatus: { not: TempVoiceOwnershipStatus.CLAIMABLE },
      },
      orderBy: { createdAt: "asc" },
    });
    return records.map((record) => this.map(record));
  }

  public countActiveByOwner(guildId: string, ownerId: string): Promise<number> {
    return this.prisma.tempVoiceChannel.count({
      where: {
        guildId,
        ownerId,
        lifecycle: { not: TempVoiceLifecycle.DELETED },
        ownershipStatus: { not: TempVoiceOwnershipStatus.CLAIMABLE },
      },
    });
  }

  public async listByGuild(guildId: string): Promise<TempVoiceRecord[]> {
    const records = await this.prisma.tempVoiceChannel.findMany({
      where: { guildId, lifecycle: { not: TempVoiceLifecycle.DELETED } },
      orderBy: { createdAt: "asc" },
    });
    return records.map((record) => this.map(record));
  }

  public async listDue(now: Date, limit: number): Promise<TempVoiceRecord[]> {
    const records = await this.prisma.tempVoiceChannel.findMany({
      where: {
        lifecycle: { not: TempVoiceLifecycle.DELETED },
        OR: [
          { nextReconcileAt: { lte: now } },
          { deleteAfter: { lte: now } },
          {
            ownershipStatus: TempVoiceOwnershipStatus.OWNER_GRACE,
            claimableAt: { lte: now },
          },
        ],
      },
      orderBy: { nextReconcileAt: "asc" },
      take: limit,
    });
    return records.map((record) => this.map(record));
  }

  public async update(
    aggregateId: string,
    expectedRevision: number,
    update: TempVoiceRecordUpdate,
    outbox: readonly TempVoiceOutboxWrite[] = [],
  ): Promise<TempVoiceRecord | null> {
    const nextRevision = expectedRevision + 1;
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.tempVoiceChannel.updateMany({
        where: { id: aggregateId, revision: expectedRevision },
        data: {
          ...this.toPrismaUpdate(update),
          revision: { increment: 1 },
        },
      });

      if (result.count !== 1) return null;

      if (outbox.length > 0) {
        await transaction.tempVoiceOutbox.createMany({
          data: outbox.map((effect) => ({
            aggregateId,
            revision: nextRevision,
            kind: effect.kind,
            dedupeKey: effect.dedupeKey,
            payload: (effect.payload ?? {}) as Prisma.InputJsonValue,
            availableAt: effect.availableAt,
          })),
          skipDuplicates: true,
        });
      }

      const updated = await transaction.tempVoiceChannel.findUniqueOrThrow({
        where: { id: aggregateId },
      });
      return this.map(updated);
    });
  }

  public async markDeleted(
    aggregateId: string,
    now: Date,
  ): Promise<TempVoiceRecord | null> {
    const current = await this.findById(aggregateId);
    if (!current) return null;
    return this.update(current.id, current.revision, {
      lifecycle: TempVoiceLifecycleState.DELETED,
      deletedAt: now,
      nextReconcileAt: new Date(now.getTime() + 86_400_000),
      lastReconciledAt: now,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
  }

  public setLifecycle(
    aggregateId: string,
    expectedRevision: number,
    lifecycle: TempVoiceLifecycleState,
    update: TempVoiceRecordUpdate = {},
  ): Promise<TempVoiceRecord | null> {
    return this.update(aggregateId, expectedRevision, { ...update, lifecycle });
  }

  private toPrismaUpdate(
    update: TempVoiceRecordUpdate,
  ): Prisma.TempVoiceChannelUpdateManyMutationInput {
    return {
      ...(update.channelId !== undefined && { channelId: update.channelId }),
      ...(update.ownerId !== undefined && { ownerId: update.ownerId }),
      ...(update.lifecycle !== undefined && { lifecycle: update.lifecycle }),
      ...(update.ownershipStatus !== undefined && {
        ownershipStatus: update.ownershipStatus,
      }),
      ...(update.ownershipEpoch !== undefined && {
        ownershipEpoch: update.ownershipEpoch,
      }),
      ...(update.ownerAbsentAt !== undefined && {
        ownerAbsentAt: update.ownerAbsentAt,
      }),
      ...(update.claimableAt !== undefined && {
        claimableAt: update.claimableAt,
      }),
      ...(update.emptySince !== undefined && { emptySince: update.emptySince }),
      ...(update.deleteAfter !== undefined && {
        deleteAfter: update.deleteAfter,
      }),
      ...(update.customName !== undefined && { customName: update.customName }),
      ...(update.customUserLimit !== undefined && {
        customUserLimit: update.customUserLimit,
      }),
      ...(update.customBitrate !== undefined && {
        customBitrate: update.customBitrate,
      }),
      ...(update.customRegion !== undefined && {
        customRegion: update.customRegion,
      }),
      ...(update.isLocked !== undefined && { isLocked: update.isLocked }),
      ...(update.isHidden !== undefined && { isHidden: update.isHidden }),
      ...(update.allowedUserIds !== undefined && {
        allowedUserIds: jsonArray(update.allowedUserIds),
      }),
      ...(update.deniedUserIds !== undefined && {
        deniedUserIds: jsonArray(update.deniedUserIds),
      }),
      ...(update.trustedUserIds !== undefined && {
        trustedUserIds: jsonArray(update.trustedUserIds),
      }),
      ...(update.managedUserIds !== undefined && {
        managedUserIds: jsonArray(update.managedUserIds),
      }),
      ...(update.nextReconcileAt !== undefined && {
        nextReconcileAt: update.nextReconcileAt,
      }),
      ...(update.lastActiveAt !== undefined && {
        lastActiveAt: update.lastActiveAt,
      }),
      ...(update.lastReconciledAt !== undefined && {
        lastReconciledAt: update.lastReconciledAt,
      }),
      ...(update.failureCount !== undefined && {
        failureCount: update.failureCount,
      }),
      ...(update.lastErrorCode !== undefined && {
        lastErrorCode: update.lastErrorCode,
      }),
      ...(update.lastErrorMessage !== undefined && {
        lastErrorMessage: update.lastErrorMessage,
      }),
      ...(update.deletedAt !== undefined && { deletedAt: update.deletedAt }),
    };
  }

  private map(record: TempVoiceChannel): TempVoiceRecord {
    return {
      id: asTempVoiceAggregateId(record.id),
      guildId: asTempVoiceGuildId(record.guildId),
      channelId: record.channelId
        ? asTempVoiceChannelId(record.channelId)
        : null,
      ownerId: asTempVoiceUserId(record.ownerId),
      operationId: record.operationId,
      lifecycle: record.lifecycle as TempVoiceLifecycleState,
      ownershipStatus: record.ownershipStatus as TempVoiceOwnershipState,
      revision: record.revision,
      ownershipEpoch: record.ownershipEpoch,
      ownerAbsentAt: record.ownerAbsentAt,
      claimableAt: record.claimableAt,
      emptySince: record.emptySince,
      deleteAfter: record.deleteAfter,
      createdByJoinChannelId: record.createdByJoinChannelId,
      customName: record.customName,
      customUserLimit: record.customUserLimit,
      customBitrate: record.customBitrate,
      customRegion: record.customRegion,
      isLocked: record.isLocked,
      isHidden: record.isHidden,
      allowedUserIds: stringArray(record.allowedUserIds),
      deniedUserIds: stringArray(record.deniedUserIds),
      trustedUserIds: stringArray(record.trustedUserIds),
      managedUserIds: stringArray(record.managedUserIds),
      controlPanelChannelId: record.controlPanelChannelId,
      controlPanelMessageId: record.controlPanelMessageId,
      nextReconcileAt: record.nextReconcileAt,
      lastActiveAt: record.lastActiveAt,
      lastReconciledAt: record.lastReconciledAt,
      failureCount: record.failureCount,
      lastErrorCode: record.lastErrorCode,
      lastErrorMessage: record.lastErrorMessage,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
