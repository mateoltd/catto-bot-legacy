export type TempVoiceAggregateId = string & {
  readonly __brand: "TempVoiceAggregateId";
};
export type TempVoiceChannelId = string & {
  readonly __brand: "TempVoiceChannelId";
};
export type TempVoiceGuildId = string & {
  readonly __brand: "TempVoiceGuildId";
};
export type TempVoiceUserId = string & { readonly __brand: "TempVoiceUserId" };

export const asTempVoiceAggregateId = (value: string): TempVoiceAggregateId =>
  value as TempVoiceAggregateId;
export const asTempVoiceChannelId = (value: string): TempVoiceChannelId =>
  value as TempVoiceChannelId;
export const asTempVoiceGuildId = (value: string): TempVoiceGuildId =>
  value as TempVoiceGuildId;
export const asTempVoiceUserId = (value: string): TempVoiceUserId =>
  value as TempVoiceUserId;

export const TEMP_VOICE_OWNERSHIP_GRACE_MS = 300_000;

export enum TempVoiceLifecycleState {
  CREATING = "CREATING",
  ACTIVE = "ACTIVE",
  DELETE_PENDING = "DELETE_PENDING",
  DELETING = "DELETING",
  DELETE_FAILED = "DELETE_FAILED",
  DELETED = "DELETED",
}

export enum TempVoiceOwnershipState {
  OWNER_PRESENT = "OWNER_PRESENT",
  OWNER_GRACE = "OWNER_GRACE",
  CLAIMABLE = "CLAIMABLE",
}

type TempVoiceOwnershipReference = Pick<
  TempVoiceAggregateState,
  "ownerId" | "ownershipStatus"
>;

/**
 * CLAIMABLE records retain the previous owner id for audit and notification delivery only.
 * Ownership-sensitive behavior must go through these predicates.
 */
export const hasCurrentTempVoiceOwner = (
  state: TempVoiceOwnershipReference,
): boolean => state.ownershipStatus !== TempVoiceOwnershipState.CLAIMABLE;

export const isCurrentTempVoiceOwner = (
  state: TempVoiceOwnershipReference,
  userId: string,
): boolean => hasCurrentTempVoiceOwner(state) && state.ownerId === userId;

export interface TempVoiceAggregateState {
  readonly id: TempVoiceAggregateId;
  readonly guildId: TempVoiceGuildId;
  readonly channelId: TempVoiceChannelId | null;
  readonly ownerId: TempVoiceUserId;
  readonly lifecycle: TempVoiceLifecycleState;
  readonly ownershipStatus: TempVoiceOwnershipState;
  readonly ownershipEpoch: number;
  readonly revision: number;
  readonly ownerAbsentAt: Date | null;
  readonly claimableAt: Date | null;
  readonly emptySince: Date | null;
  readonly deleteAfter: Date | null;
}

export interface TempVoiceRecord extends TempVoiceAggregateState {
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
  readonly managedUserIds: readonly string[];
  readonly controlPanelChannelId: string | null;
  readonly controlPanelMessageId: string | null;
  readonly nextReconcileAt: Date;
  readonly lastActiveAt: Date;
  readonly lastReconciledAt: Date | null;
  readonly failureCount: number;
  readonly lastErrorCode: string | null;
  readonly lastErrorMessage: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TempVoicePresenceObservation {
  readonly now: Date;
  readonly ownerPresent: boolean;
  readonly eligibleHumanCount: number;
  readonly emptyDeleteDelayMs: number;
}

export interface TempVoiceStatePatch {
  readonly lifecycle?: TempVoiceLifecycleState;
  readonly ownershipStatus?: TempVoiceOwnershipState;
  readonly ownershipEpoch?: number;
  readonly ownerId?: TempVoiceUserId;
  readonly ownerAbsentAt?: Date | null;
  readonly claimableAt?: Date | null;
  readonly emptySince?: Date | null;
  readonly deleteAfter?: Date | null;
}

export type TempVoiceOccupancyTransition =
  | "UNCHANGED"
  | "BECAME_EMPTY"
  | "BECAME_ACTIVE";

export type TempVoiceOwnershipTransition =
  | "UNCHANGED"
  | "OWNER_LEFT"
  | "OWNER_RETURNED"
  | "OWNERSHIP_BECAME_CLAIMABLE"
  | "OWNERSHIP_TRANSFERRED"
  | "OWNERSHIP_CLAIMED";

export interface TempVoiceTransition {
  readonly changed: boolean;
  readonly occupancy: TempVoiceOccupancyTransition;
  readonly ownership: TempVoiceOwnershipTransition;
  readonly patch: TempVoiceStatePatch;
}

export interface TempVoiceSuccess<T = undefined> {
  readonly ok: true;
  readonly data: T;
}

export interface TempVoiceFailure {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export type TempVoiceResult<T = undefined> =
  | TempVoiceSuccess<T>
  | TempVoiceFailure;
