import {
  hasCurrentTempVoiceOwner,
  TEMP_VOICE_OWNERSHIP_GRACE_MS,
  TempVoiceLifecycleState,
  TempVoiceOwnershipState,
} from "./temp-voice.types.js";
import type {
  TempVoiceAggregateState,
  TempVoiceOccupancyTransition,
  TempVoiceOwnershipTransition,
  TempVoicePresenceObservation,
  TempVoiceStatePatch,
  TempVoiceTransition,
  TempVoiceUserId,
} from "./temp-voice.types.js";

const noChange = (): TempVoiceTransition => ({
  changed: false,
  occupancy: "UNCHANGED",
  ownership: "UNCHANGED",
  patch: {},
});

export class TempVoicePolicy {
  public observePresence(
    state: TempVoiceAggregateState,
    observation: TempVoicePresenceObservation,
  ): TempVoiceTransition {
    if (
      state.lifecycle === TempVoiceLifecycleState.CREATING ||
      state.lifecycle === TempVoiceLifecycleState.DELETED
    ) {
      return noChange();
    }

    const patch: TempVoiceStatePatch = {};
    const occupancy = this.observeOccupancy(state, observation, patch);
    const ownership = this.observeOwnership(state, observation, patch);
    return {
      changed: occupancy !== "UNCHANGED" || ownership !== "UNCHANGED",
      occupancy,
      ownership,
      patch,
    };
  }

  public transferOwnership(
    state: TempVoiceAggregateState,
    newOwnerId: TempVoiceUserId,
    ownership: "OWNERSHIP_TRANSFERRED" | "OWNERSHIP_CLAIMED",
  ): TempVoiceTransition {
    if (hasCurrentTempVoiceOwner(state) && state.ownerId === newOwnerId) {
      return noChange();
    }

    return {
      changed: true,
      occupancy: "UNCHANGED",
      ownership,
      patch: {
        lifecycle: TempVoiceLifecycleState.ACTIVE,
        ownerId: newOwnerId,
        ownershipStatus: TempVoiceOwnershipState.OWNER_PRESENT,
        ownershipEpoch: state.ownershipEpoch + 1,
        ownerAbsentAt: null,
        claimableAt: null,
        emptySince: null,
        deleteAfter: null,
      },
    };
  }

  private observeOccupancy(
    state: TempVoiceAggregateState,
    observation: TempVoicePresenceObservation,
    patch: TempVoiceStatePatch,
  ): TempVoiceOccupancyTransition {
    if (observation.eligibleHumanCount === 0) {
      if (
        state.lifecycle === TempVoiceLifecycleState.DELETE_PENDING &&
        state.emptySince &&
        state.deleteAfter
      ) {
        return "UNCHANGED";
      }

      Object.assign(patch, {
        lifecycle: TempVoiceLifecycleState.DELETE_PENDING,
        emptySince: observation.now,
        deleteAfter: new Date(
          observation.now.getTime() + observation.emptyDeleteDelayMs,
        ),
      });
      return "BECAME_EMPTY";
    }

    const wasPendingDeletion =
      state.lifecycle === TempVoiceLifecycleState.DELETE_PENDING ||
      state.lifecycle === TempVoiceLifecycleState.DELETE_FAILED ||
      state.lifecycle === TempVoiceLifecycleState.DELETING ||
      state.emptySince !== null ||
      state.deleteAfter !== null;
    if (!wasPendingDeletion) return "UNCHANGED";

    Object.assign(patch, {
      lifecycle: TempVoiceLifecycleState.ACTIVE,
      emptySince: null,
      deleteAfter: null,
    });
    return "BECAME_ACTIVE";
  }

  private observeOwnership(
    state: TempVoiceAggregateState,
    observation: TempVoicePresenceObservation,
    patch: TempVoiceStatePatch,
  ): TempVoiceOwnershipTransition {
    if (state.ownershipStatus === TempVoiceOwnershipState.CLAIMABLE) {
      return "UNCHANGED";
    }

    if (observation.ownerPresent) {
      if (
        state.ownershipStatus === TempVoiceOwnershipState.OWNER_PRESENT &&
        !state.ownerAbsentAt &&
        !state.claimableAt
      ) {
        return "UNCHANGED";
      }

      Object.assign(patch, {
        ownershipStatus: TempVoiceOwnershipState.OWNER_PRESENT,
        ownershipEpoch: state.ownershipEpoch + 1,
        ownerAbsentAt: null,
        claimableAt: null,
      });
      return "OWNER_RETURNED";
    }

    if (state.ownershipStatus === TempVoiceOwnershipState.OWNER_PRESENT) {
      Object.assign(patch, {
        ownershipStatus: TempVoiceOwnershipState.OWNER_GRACE,
        ownershipEpoch: state.ownershipEpoch + 1,
        ownerAbsentAt: observation.now,
        claimableAt: new Date(
          observation.now.getTime() + TEMP_VOICE_OWNERSHIP_GRACE_MS,
        ),
      });
      return "OWNER_LEFT";
    }

    if (
      state.ownershipStatus === TempVoiceOwnershipState.OWNER_GRACE &&
      state.claimableAt &&
      observation.now.getTime() >= state.claimableAt.getTime()
    ) {
      Object.assign(patch, {
        ownershipStatus: TempVoiceOwnershipState.CLAIMABLE,
      });
      return "OWNERSHIP_BECAME_CLAIMABLE";
    }

    return "UNCHANGED";
  }
}
