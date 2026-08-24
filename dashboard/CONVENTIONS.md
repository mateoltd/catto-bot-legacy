# Dashboard Conventions

These conventions favor operational clarity over decoration.

## Interface

- Use the monochrome tokens in `app/globals.css`. Color is reserved for success, warning, and
  destructive states.
- Use square, bordered surfaces and short transitions. Avoid gradients, glow effects, floating
  decoration, and motion that does not communicate state.
- Every visible control must work. Do not ship placeholder buttons, fake status values, or inputs
  without behavior.
- Use monospace for headings, labels, identifiers, and metrics; use the sans-serif font for body
  copy and form content.
- Keep keyboard focus visible, name icon-only controls, and preserve useful empty, loading, error,
  and disabled states.

## Architecture

- Server components own authentication, authorization, and initial data loading.
- Client components own interaction state. They call the same-origin `/api/*` proxy and never read
  server-only environment variables.
- Put shared domain decisions in `lib/` instead of repeating permission or response-shape logic in
  pages and components.
- Keep route files thin. Reusable page chrome belongs in `components/dashboard/`; feature-specific
  forms remain isolated from navigation and session concerns.
- Preserve route URLs when reorganizing files unless a migration is intentional and documented.

## Code Quality

- Prefer typed response boundaries and explicit failure states over `any`, silent fallbacks, or
  optimistic assumptions about backend availability.
- Comments explain constraints, tradeoffs, or surprising behavior. Do not narrate markup or restate
  the next line of code.
- Remove unused files and compatibility layers once their callers are gone.
- Test behavior with meaningful regression risk. Do not add snapshots or presentation-only tests by
  default.
