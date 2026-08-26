# Temp Voice Internal Conventions

These rules are mandatory for the temp voice module. They refine the repository-wide rules in
`docs/RULES.md` and exist to keep Discord, PostgreSQL, and BullMQ behavior predictable.

## Boundaries

- `domain/` is pure TypeScript. It cannot import Discord, Prisma, Redis, BullMQ, Sapphire, or the
  process clock.
- `application/` owns use cases and orchestration. Only the coordinator may decide lifecycle or
  ownership transitions.
- `ports/` contains interfaces for persistence, transport, Discord, time, and projections.
- `infrastructure/` implements ports. Discord listeners, commands, routes, and interactions are
  adapters: they validate transport-level input and submit typed messages only.
- A service must not instantiate another infrastructure service. Dependencies are constructor
  injected from one composition root.

## State and side effects

- PostgreSQL is the source of truth for desired state. Discord is observed state; BullMQ is a
  delivery mechanism, never authoritative storage.
- State changes and outbox effects are committed in the same database transaction.
- Every external effect is idempotent and identified by aggregate, revision, kind, and epoch where
  applicable.
- Expected failures return discriminated results. Exceptions are reserved for unavailable
  dependencies, violated invariants, or retryable infrastructure failures.
- Never turn an unknown Discord failure into `not found`. Only Discord's explicit unknown-resource
  response may finalize deletion or remove a resource reference.
- Join-to-create is recovery-first: an owned, non-deleted aggregate is reused or resumed before
  cooldown and creation are considered. A transient recovery failure must never fall through to a
  second channel creation.
- Occupancy and ownership are orthogonal. An empty channel may be pending deletion while its owner
  is absent; lifecycle transitions must never invent owner presence to suppress a notification.
- Automated recovery may move a member into a recoverable owned channel, but a rejected creation
  must never disconnect them. Disconnect effects are reserved for explicit moderation commands.
- Never swallow errors from persistence, channel creation/deletion, ownership, permissions, or
  outbox delivery.

## Concurrency and time

- Work is serialized per aggregate, not globally. Leases are token-owned, renewable, and released
  with compare-and-delete semantics.
- Brief lease contention is expected when Discord emits events caused by the bot's own mutation.
  Acquisition waits are bounded and exhausted contention is retried by the transport.
- Owner quota checks and ownership acquisition use a guild-member lease before the aggregate
  lease. This makes concurrent creates, claims, and transfers converge without global locking.
- Voice presence is level-triggered, not edge-dependent. The transport may coalesce repeated dirty
  signals for one aggregate, but it must reconcile once more when the dirty generation changes
  during processing.
- Persisted `revision` and `ownershipEpoch` fence stale workers, jobs, and components.
- Domain code receives `now` explicitly. It never calls `Date.now()` or constructs the current
  date itself.
- Retries use bounded exponential backoff with jitter. A retry must not erase the last failure.

## Discord projections

- Projectors converge observed Discord state to the aggregate. They do not make business
  decisions.
- Permission projection edits only module-owned bits and preserves unrelated overwrites.
- Every voice-state signal requests panel reconciliation. A render hash may skip an identical edit;
  timers or debouncing may not hide a distinct rendered state.
- Ownership prompts use one durable delivery slot per aggregate and delivery kind. A new absence
  episode edits the existing prompt when its destination is reusable; stale components remain
  fenced by `ownershipEpoch`.
- Components contain opaque routing data only. Every interaction re-authorizes the actor and
  revalidates current aggregate revision/epoch and voice membership.
- Bots are never ownership candidates and do not keep an otherwise empty temp channel alive.

## Naming and files

- Domain events use past-tense names; commands use imperative names; projections use
  `reconcile...` names.
- Files follow `kebab-case`; classes, interfaces, and enum names use `PascalCase`; enum members and
  constants use `UPPER_SNAKE_CASE`.
- Avoid generic `utils.ts`, `helpers.ts`, and `manager.ts`. Name files after the policy or capability
  they own.
- Public module exports live in `index.ts`; infrastructure internals are not re-exported.

## Verification

- Typecheck and lint are required.
- Tests are added only for invariants that typechecking and adapter checks cannot protect: pure
  lifecycle transitions, stale epoch fencing, concurrency ownership, and retry/recovery behavior.
- Tests target public behavior and use fake ports; they do not assert private method calls.
