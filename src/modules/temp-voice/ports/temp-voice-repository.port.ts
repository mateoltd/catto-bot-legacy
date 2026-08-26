import type {
  TempVoiceLifecycleState,
  TempVoiceRecord,
  TempVoiceStatePatch,
} from "../domain/temp-voice.types.js";

export interface TempVoiceCreateRecord {
  readonly guildId: string;
  readonly ownerId: string;
  readonly operationId: string;
  readonly createdByJoinChannelId: string;
  readonly customName: string | null;
  readonly customUserLimit: number | null;
  readonly customBitrate: number | null;
  readonly customRegion: string | null;
  readonly isLocked: boolean;
  readonly isHidden: boolean;
  readonly allowedUserIds: readonly string[];
  readonly deniedUserIds: readonly string[];
  readonly trustedUserIds: readonly string[];
  readonly managedUserIds?: readonly string[];
  readonly now: Date;
}

export interface TempVoiceRecordUpdate extends TempVoiceStatePatch {
  readonly channelId?: string | null;
  readonly customName?: string | null;
  readonly customUserLimit?: number | null;
  readonly customBitrate?: number | null;
  readonly customRegion?: string | null;
  readonly isLocked?: boolean;
  readonly isHidden?: boolean;
  readonly allowedUserIds?: readonly string[];
  readonly deniedUserIds?: readonly string[];
  readonly trustedUserIds?: readonly string[];
  readonly managedUserIds?: readonly string[];
  readonly nextReconcileAt?: Date;
  readonly lastActiveAt?: Date;
  readonly lastReconciledAt?: Date | null;
  readonly failureCount?: number;
  readonly lastErrorCode?: string | null;
  readonly lastErrorMessage?: string | null;
  readonly deletedAt?: Date | null;
}

export interface TempVoiceOutboxWrite {
  readonly kind:
    | "CREATE_CHANNEL"
    | "MOVE_OWNER"
    | "DISCONNECT_USERS"
    | "DELETE_CHANNEL"
    | "RECONCILE_CHANNEL"
    | "RECONCILE_PERMISSIONS"
    | "RECONCILE_PANEL"
    | "DELIVER_OWNERSHIP_NOTICE"
    | "DELIVER_OWNER_DM";
  readonly dedupeKey: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly availableAt?: Date;
}

export interface TempVoiceRepository {
  create(record: TempVoiceCreateRecord): Promise<TempVoiceRecord | null>;
  findById(aggregateId: string): Promise<TempVoiceRecord | null>;
  findByChannelId(channelId: string): Promise<TempVoiceRecord | null>;
  findActiveByOwner(
    guildId: string,
    ownerId: string,
  ): Promise<TempVoiceRecord[]>;
  countActiveByOwner(guildId: string, ownerId: string): Promise<number>;
  listByGuild(guildId: string): Promise<TempVoiceRecord[]>;
  listDue(now: Date, limit: number): Promise<TempVoiceRecord[]>;
  update(
    aggregateId: string,
    expectedRevision: number,
    update: TempVoiceRecordUpdate,
    outbox?: readonly TempVoiceOutboxWrite[],
  ): Promise<TempVoiceRecord | null>;
  markDeleted(aggregateId: string, now: Date): Promise<TempVoiceRecord | null>;
  setLifecycle(
    aggregateId: string,
    expectedRevision: number,
    lifecycle: TempVoiceLifecycleState,
    update?: TempVoiceRecordUpdate,
  ): Promise<TempVoiceRecord | null>;
}
