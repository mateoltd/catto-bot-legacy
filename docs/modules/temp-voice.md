# Temporary Voice Channels

The temp voice module creates user-owned Discord voice channels and continuously converges Discord
to durable state stored in PostgreSQL. BullMQ transports commands, observations, and outbox work;
it is not the source of truth.

The implementation rules are defined in
[`src/modules/temp-voice/CONVENTIONS.md`](../../src/modules/temp-voice/CONVENTIONS.md).

## Architecture

```text
Discord listeners / interactions / API
                  |
                  v
         typed command or signal
                  |
                  v
       BullTempVoiceTransport
                  |
                  v
       TempVoiceCoordinator
          |              |
          v              v
   PostgreSQL state   transactional outbox
                         |
                         v
            Discord settings, permissions,
              panel, notices, DM, deletion
```

The main boundaries are:

- `domain/`: pure ownership and lifecycle policy.
- `application/`: the coordinator and read models.
- `ports/`: repository, transport, projection, settings, clock, and lease contracts.
- `infrastructure/`: Prisma, BullMQ, Redis lease, Discord projection, and error classification.
- listeners, commands, interactions, and routes: transport adapters only.

All mutation entry points converge through `TempVoiceCoordinator`. Compatibility services used by
older commands are read-only or translate their operation to a typed coordinator command.

## Durable state

`TempVoiceChannel` is an aggregate, even before its Discord channel exists. `operationId` makes
Discord creation adoptable after a worker or database failure. `revision` fences concurrent state
writes, and `ownershipEpoch` invalidates old ownership prompts and scheduled jobs.

Lifecycle states:

| State            | Meaning                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| `CREATING`       | The database record exists and channel creation is pending or recovering.  |
| `ACTIVE`         | The Discord channel exists and is in normal use.                           |
| `DELETE_PENDING` | The channel is empty and has a persisted deletion deadline.                |
| `DELETING`       | A forced or due deletion is being delivered.                               |
| `DELETE_FAILED`  | Discord rejected deletion; reconciliation will retry and expose the error. |
| `DELETED`        | The Discord resource is confirmed deleted or explicitly reported missing.  |

Ownership states:

| State           | Meaning                                                              |
| --------------- | -------------------------------------------------------------------- |
| `OWNER_PRESENT` | Ownership is healthy.                                                |
| `OWNER_GRACE`   | The owner is absent and the persisted 300-second deadline is active. |
| `CLAIMABLE`     | The channel has no current owner; a human inside may claim it.       |

Bots do not count as occupants, cannot inherit ownership, and do not keep an empty channel alive.

## Ownership flow

1. The owner always receives explicit `ViewChannel`, `Connect`, `Speak`, `Stream`, and `UseVAD`
   permission bits while they own the channel.
2. If the owner leaves, ownership independently enters `OWNER_GRACE`, advances its epoch, and
   persists `claimableAt = now + 300 seconds`. If the channel is also empty, lifecycle separately
   enters `DELETE_PENDING`; it never reports the absent owner as present.
3. The projector updates the control panel, posts a channel notice, and attempts a DM containing a
   paginated successor selector. A DM failure is recorded but does not block the channel notice or
   panel.
4. If the owner returns, the coordinator observes current Discord membership, cancels the grace
   state, advances the epoch, and edits the durable prompt to its inactive state. Repeated
   leave/return episodes reuse the same delivery slot instead of posting more messages.
5. The owner may transfer only to a human currently in the channel. The coordinator re-authorizes
   the actor and checks the prompt epoch at execution time.
6. If the deadline expires, a durable reconciliation transitions the channel to `CLAIMABLE`.
   The previous owner id remains only as audit and notification context: it no longer grants
   permissions, management access, recovery routing, or consumes the owner's channel quota.
7. A claim succeeds only for a human currently inside the channel. A guild-member lease serializes
   ownership quota acquisition, then the aggregate lease and revision compare-and-set make the
   first valid claim the winner.

If no humans remain, empty-channel deletion proceeds independently from ownership grace. Until
deletion begins, the existing channel still projects the ownership notice and owner DM. Rejoining
before the deletion deadline cancels cleanup after the coordinator verifies current Discord
membership.

## Central projection

Every `VoiceStateUpdate` publishes an observation. The transport marks its managed old and new
channels dirty and coalesces repeated signals per aggregate. A worker fetches current channel state,
applies the domain policy, commits a new revision plus an outbox effect, and projects the complete
desired state. If the dirty generation changes during processing, it reconciles once more; events
are collapsed without losing the final state. No ownership branch manually refreshes the panel.

The projector owns:

- channel name, limit, bitrate, and region convergence;
- module-owned permission bits while preserving unrelated overwrites;
- forced owner access;
- Components V2 control-panel rendering;
- ownership notice and owner-DM delivery;
- message supersession when an ownership epoch ends.

Render hashes avoid identical Discord edits. Ownership prompts use a stable delivery slot while
`ownershipEpoch` continues to fence old components. A deep
reconciliation fetches messages even when the hash matches, so manually deleted panels or notices
are recreated. Disabling the control panel removes its projected message; re-enabling it recreates
the projection.

## Outbox and recovery

Aggregate changes and external effects are committed in one Prisma transaction. The outbox sweeper
recovers pending, failed, or abandoned effects and also schedules aggregates whose ownership,
deletion, or deep-reconciliation deadline is due.

Work is serialized per aggregate with a renewable, token-owned Redis lease. State updates also use
revision compare-and-set. Outbox state is re-read after acquiring the lease so duplicate BullMQ
deliveries cannot execute an already completed effect.

Creates, claims, and transfers additionally serialize ownership acquisition with a guild-member
lease before taking an aggregate lease. This preserves per-user limits across different channels
without a guild-wide lock. Join-to-create rejection never disconnects a member; cooldown work is
retried while the member remains in the creation channel, and only explicit moderation commands
may emit disconnect effects.

Discord errors are classified explicitly:

- an explicit unknown-channel response can finalize the aggregate as deleted;
- missing permissions become visible retryable failures;
- rate limits, network errors, and unknown failures retain the record and retry with bounded
  exponential backoff;
- a nullable or transient fetch is not treated as proof of deletion.

Startup queues reconciliation for resident guilds. A periodic sweep provides recovery after a
restart, deployment, Redis interruption, Discord outage, or an exhausted BullMQ job.

## Configuration and API

The ownership policy is deliberately fixed: `ownershipGraceSeconds` is returned as `300`, and
owner transfer is always supported. The removed `ownerLeaveStrategy` setting is not accepted.

`controlPanelEnabled` controls panel projection. `allowOwnerManagement` maps independently to
channel customization; disabling one no longer silently disables the other. API bitrate values use
Discord units (bits per second), while PostgreSQL stores the module configuration in kilobits per
second. Schema fallback, API creation, automatic setup, and dashboard drafts share the canonical
defaults: a 300-second empty-channel deletion delay, a 10-second creation cooldown, three channels
per owner, unlimited users, and 64 kbps bitrate. Existing guild rows remain authoritative and are
never overwritten by fallback defaults.

Channel-list responses expose `lifecycle`, `ownershipStatus`, `claimableAt`, `deleteAfter`, and the
last cleanup error so the dashboard does not infer durable state from the Discord cache. For a
`CLAIMABLE` channel, the API returns a null current owner even though PostgreSQL retains the prior
owner id for audit context.

Deleting configuration atomically hides and disables the config, then writes forced deletion
effects for every managed channel. New aggregate creation takes a database share lock and cannot
cross that transition. The sweeper removes the internal config row after every aggregate is
`DELETED`. Join channels, categories, and log channels are preserved because deleting setup
resources is a separate administrator decision.

## Migration note

Migration `20260824230000_rewrite_temp_voice_lifecycle` carries legacy channels into the durable
aggregate schema and schedules immediate reconciliation against current Discord presence. Existing
control-panel message references are adopted into the stable delivery slot, avoiding duplicate
panels. Legacy configuration bitrate values are normalized from bits per second to kilobits per
second without changing their effective Discord bitrate. Deploy the migration before starting
workers using the new transport.
