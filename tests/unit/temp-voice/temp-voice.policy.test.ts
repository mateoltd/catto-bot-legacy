import { describe, expect, it } from "vitest";

import { TempVoicePolicy } from "#modules/temp-voice/domain/temp-voice.policy.js";
import {
  asTempVoiceAggregateId,
  asTempVoiceChannelId,
  asTempVoiceGuildId,
  asTempVoiceUserId,
  TempVoiceLifecycleState,
  TempVoiceOwnershipState,
  type TempVoiceAggregateState,
} from "#modules/temp-voice/domain/temp-voice.types.js";

const NOW = new Date("2026-08-24T12:00:00.000Z");

const state = (
  overrides: Partial<TempVoiceAggregateState> = {},
): TempVoiceAggregateState => ({
  id: asTempVoiceAggregateId("aggregate"),
  guildId: asTempVoiceGuildId("guild"),
  channelId: asTempVoiceChannelId("channel"),
  ownerId: asTempVoiceUserId("owner"),
  lifecycle: TempVoiceLifecycleState.ACTIVE,
  ownershipStatus: TempVoiceOwnershipState.OWNER_PRESENT,
  ownershipEpoch: 4,
  revision: 9,
  ownerAbsentAt: null,
  claimableAt: null,
  emptySince: null,
  deleteAfter: null,
  ...overrides,
});

describe("TempVoicePolicy", () => {
  const policy = new TempVoicePolicy();

  it("starts a fenced 300-second grace period when the owner leaves members behind", () => {
    const transition = policy.observePresence(state(), {
      now: NOW,
      ownerPresent: false,
      eligibleHumanCount: 2,
      emptyDeleteDelayMs: 5_000,
    });

    expect(transition).toMatchObject({
      changed: true,
      occupancy: "UNCHANGED",
      ownership: "OWNER_LEFT",
      patch: {
        ownershipStatus: TempVoiceOwnershipState.OWNER_GRACE,
        ownershipEpoch: 5,
        ownerAbsentAt: NOW,
      },
    });
    expect(transition.patch.claimableAt).toEqual(
      new Date(NOW.getTime() + 300_000),
    );
  });

  it("cancels the prompt and advances the epoch when the owner returns", () => {
    const transition = policy.observePresence(
      state({
        ownershipStatus: TempVoiceOwnershipState.OWNER_GRACE,
        ownerAbsentAt: new Date(NOW.getTime() - 60_000),
        claimableAt: new Date(NOW.getTime() + 240_000),
      }),
      {
        now: NOW,
        ownerPresent: true,
        eligibleHumanCount: 2,
        emptyDeleteDelayMs: 5_000,
      },
    );

    expect(transition).toMatchObject({
      occupancy: "UNCHANGED",
      ownership: "OWNER_RETURNED",
      patch: {
        ownershipStatus: TempVoiceOwnershipState.OWNER_PRESENT,
        ownershipEpoch: 5,
        ownerAbsentAt: null,
        claimableAt: null,
      },
    });
  });

  it("opens ownership for claim only after the persisted deadline", () => {
    const transition = policy.observePresence(
      state({
        ownershipStatus: TempVoiceOwnershipState.OWNER_GRACE,
        claimableAt: NOW,
      }),
      {
        now: NOW,
        ownerPresent: false,
        eligibleHumanCount: 1,
        emptyDeleteDelayMs: 5_000,
      },
    );

    expect(transition).toMatchObject({
      occupancy: "UNCHANGED",
      ownership: "OWNERSHIP_BECAME_CLAIMABLE",
      patch: { ownershipStatus: TempVoiceOwnershipState.CLAIMABLE },
    });
  });

  it("does not restore the previous owner merely because they return after claimability", () => {
    const transition = policy.observePresence(
      state({
        ownershipStatus: TempVoiceOwnershipState.CLAIMABLE,
        ownerAbsentAt: new Date(NOW.getTime() - 300_000),
        claimableAt: NOW,
      }),
      {
        now: new Date(NOW.getTime() + 1_000),
        ownerPresent: true,
        eligibleHumanCount: 2,
        emptyDeleteDelayMs: 5_000,
      },
    );

    expect(transition).toEqual({
      changed: false,
      occupancy: "UNCHANGED",
      ownership: "UNCHANGED",
      patch: {},
    });
  });

  it("allows the previous owner to explicitly claim an ownerless channel", () => {
    const transition = policy.transferOwnership(
      state({ ownershipStatus: TempVoiceOwnershipState.CLAIMABLE }),
      asTempVoiceUserId("owner"),
      "OWNERSHIP_CLAIMED",
    );

    expect(transition).toMatchObject({
      changed: true,
      ownership: "OWNERSHIP_CLAIMED",
      patch: {
        ownerId: "owner",
        ownershipStatus: TempVoiceOwnershipState.OWNER_PRESENT,
        ownershipEpoch: 5,
      },
    });
  });

  it("tracks empty cleanup and owner absence independently", () => {
    const transition = policy.observePresence(
      state({
        ownershipStatus: TempVoiceOwnershipState.OWNER_GRACE,
        ownerAbsentAt: new Date(NOW.getTime() - 60_000),
        claimableAt: new Date(NOW.getTime() + 240_000),
      }),
      {
        now: NOW,
        ownerPresent: false,
        eligibleHumanCount: 0,
        emptyDeleteDelayMs: 5_000,
      },
    );

    expect(transition).toMatchObject({
      occupancy: "BECAME_EMPTY",
      ownership: "UNCHANGED",
      patch: {
        lifecycle: TempVoiceLifecycleState.DELETE_PENDING,
        emptySince: NOW,
      },
    });
    expect(transition.patch.deleteAfter).toEqual(
      new Date(NOW.getTime() + 5_000),
    );
  });

  it("does not claim that the owner is present when their channel becomes empty", () => {
    const transition = policy.observePresence(state(), {
      now: NOW,
      ownerPresent: false,
      eligibleHumanCount: 0,
      emptyDeleteDelayMs: 5_000,
    });

    expect(transition).toMatchObject({
      occupancy: "BECAME_EMPTY",
      ownership: "OWNER_LEFT",
      patch: {
        lifecycle: TempVoiceLifecycleState.DELETE_PENDING,
        ownershipStatus: TempVoiceOwnershipState.OWNER_GRACE,
        ownershipEpoch: 5,
        ownerAbsentAt: NOW,
      },
    });
  });

  it("does not restart ownership grace when another member enters an empty channel", () => {
    const ownerAbsentAt = new Date(NOW.getTime() - 60_000);
    const claimableAt = new Date(NOW.getTime() + 240_000);
    const transition = policy.observePresence(
      state({
        lifecycle: TempVoiceLifecycleState.DELETE_PENDING,
        ownershipStatus: TempVoiceOwnershipState.OWNER_GRACE,
        ownershipEpoch: 5,
        ownerAbsentAt,
        claimableAt,
        emptySince: new Date(NOW.getTime() - 1_000),
        deleteAfter: new Date(NOW.getTime() + 4_000),
      }),
      {
        now: NOW,
        ownerPresent: false,
        eligibleHumanCount: 1,
        emptyDeleteDelayMs: 5_000,
      },
    );

    expect(transition).toEqual({
      changed: true,
      occupancy: "BECAME_ACTIVE",
      ownership: "UNCHANGED",
      patch: {
        lifecycle: TempVoiceLifecycleState.ACTIVE,
        emptySince: null,
        deleteAfter: null,
      },
    });
  });

  it("converges crossed owners independently when each returns to their own channel", () => {
    const ownerACrossed = policy.observePresence(
      state({
        id: asTempVoiceAggregateId("aggregate-a"),
        channelId: asTempVoiceChannelId("channel-a"),
        ownerId: asTempVoiceUserId("owner-a"),
      }),
      {
        now: NOW,
        ownerPresent: false,
        eligibleHumanCount: 1,
        emptyDeleteDelayMs: 5_000,
      },
    );
    const ownerBCrossed = policy.observePresence(
      state({
        id: asTempVoiceAggregateId("aggregate-b"),
        channelId: asTempVoiceChannelId("channel-b"),
        ownerId: asTempVoiceUserId("owner-b"),
      }),
      {
        now: NOW,
        ownerPresent: false,
        eligibleHumanCount: 1,
        emptyDeleteDelayMs: 5_000,
      },
    );

    expect(ownerACrossed.ownership).toBe("OWNER_LEFT");
    expect(ownerBCrossed.ownership).toBe("OWNER_LEFT");
    expect(ownerACrossed.patch.ownerId).toBeUndefined();
    expect(ownerBCrossed.patch.ownerId).toBeUndefined();

    const ownerAReturned = policy.observePresence(
      { ...state(), ...ownerACrossed.patch },
      {
        now: new Date(NOW.getTime() + 1_000),
        ownerPresent: true,
        eligibleHumanCount: 2,
        emptyDeleteDelayMs: 5_000,
      },
    );
    const ownerBReturned = policy.observePresence(
      { ...state(), ...ownerBCrossed.patch },
      {
        now: new Date(NOW.getTime() + 1_000),
        ownerPresent: true,
        eligibleHumanCount: 2,
        emptyDeleteDelayMs: 5_000,
      },
    );

    expect(ownerAReturned.ownership).toBe("OWNER_RETURNED");
    expect(ownerBReturned.ownership).toBe("OWNER_RETURNED");
    expect(ownerAReturned.patch.ownershipStatus).toBe(
      TempVoiceOwnershipState.OWNER_PRESENT,
    );
    expect(ownerBReturned.patch.ownershipStatus).toBe(
      TempVoiceOwnershipState.OWNER_PRESENT,
    );
  });
});
