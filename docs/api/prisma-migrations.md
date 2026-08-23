# Prisma Migrations (Ephemeral Dev DB)

This is the shortest safe workflow for creating Prisma migrations when using `pnpm dev:env` (ephemeral containers).

## Why this is needed

`pnpm dev:env` uses:

- `prisma db push`
- `prisma db seed`

It does **not** build migration history (`_prisma_migrations`), so running `prisma migrate dev` directly on that DB usually reports drift/reset prompts.

## Golden rules

1. **Never create migrations against the active ephemeral app DB.**
2. **Create migrations in a clean scratch database** on the same Postgres instance.
3. For non-local/prod, use **`prisma migrate deploy`**, not `migrate dev`.

## Standard workflow (recommended)

### 1) Start ephemeral environment

```bash
pnpm dev:env
```

This updates `.env` with the current ephemeral `DATABASE_URL`.

### 2) Generate migration with helper script

```bash
pnpm prisma:migrate:create -- <migration_name>
```

Example:

```bash
pnpm prisma:migrate:create -- voice_xp_anti_farm_dampening
```

What it does:
- reads current `DATABASE_URL` (from your ephemeral run)
- creates a temporary scratch DB on the same Postgres instance
- runs `prisma migrate dev --create-only` against scratch DB
- drops the scratch DB automatically

No fixed container names or fixed ports are required.

### 3) Validate quickly

```bash
pnpm prisma migrate status
pnpm build
pnpm test
```

## Applying migrations

### Local/dev DB with migration history

```bash
pnpm prisma migrate dev
```

### Production / shared environments

```bash
pnpm prisma migrate deploy
```

## If you always get drift/mismatch

Check whether migration history exists:

```sql
SELECT count(*) 
FROM information_schema.tables 
WHERE table_name = '_prisma_migrations';
```

- `0` => DB was likely created via `db push` or manual SQL and has no Prisma migration history.
- Expected behavior: `migrate dev/status` will treat migrations as unapplied and may ask for reset.

For ephemeral disposable DBs, this is fine.  
For persistent DBs, baseline properly (resolve historical migrations) before continuing.
