# Dashboard deployment on Cloudflare

The Next.js dashboard is deployed to two independent Cloudflare Workers with the
OpenNext adapter. The Discord bot, API, PostgreSQL, Redis, and Rust services stay
on the container host.

| Environment | Git trigger                        | Dashboard               | API origin                  | Worker                        |
| ----------- | ---------------------------------- | ----------------------- | --------------------------- | ----------------------------- |
| Development | Push to `main`                     | `https://dev.catto.one` | `https://api-dev.catto.one` | `catto-dashboard-development` |
| Production  | Stable SemVer tag such as `v1.2.0` | `https://catto.one`     | `https://api.catto.one`     | `catto-dashboard-production`  |

The dashboard uses same-origin browser requests. Each Worker proxies API traffic
to its configured `BOT_API_INTERNAL_URL`, so authentication cookies remain scoped
to the dashboard hostname and cannot collide across environments.

## One-time Cloudflare setup

1. Ensure `catto.one` is an active zone in the same Cloudflare account used by
   Wrangler.
2. Remove any conflicting DNS record for `catto.one` or `dev.catto.one`. Wrangler
   creates both Custom Domains and their certificates on the first deployment.
3. Create a scoped Cloudflare API token using the **Edit Cloudflare Workers**
   template. Restrict it to the Catto account and `catto.one` zone.
4. Record the Cloudflare account ID shown in the dashboard or by
   `pnpm exec wrangler whoami`.

The API hostnames are origins for the existing container deployments. They are
not assigned to the dashboard Workers.

## GitHub configuration

Create GitHub environments named exactly `development` and `production`. Add
these secrets to both environments:

| Secret                  | Value                                        |
| ----------------------- | -------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID containing `catto.one` |
| `CLOUDFLARE_API_TOKEN`  | Scoped Workers deployment token              |

Add required reviewers to the `production` environment if releases should pause
for approval. The development environment normally has no approval gate.

The workflow at `.github/workflows/deploy-dashboard.yml` installs the locked
dependencies, runs dashboard tests, builds with OpenNext, and deploys the selected
Wrangler environment.

## Backend environment values

Configure the containerized API separately for each environment:

| Value           | Development                                    | Production                                 |
| --------------- | ---------------------------------------------- | ------------------------------------------ |
| `DASHBOARD_URL` | `https://dev.catto.one`                        | `https://catto.one`                        |
| `API_ORIGIN`    | `https://dev.catto.one`                        | `https://catto.one`                        |
| `API_REDIRECT`  | `https://api-dev.catto.one/api/oauth/callback` | `https://api.catto.one/api/oauth/callback` |

Register both `API_REDIRECT` values in the Discord Developer Portal. Do not set
`COOKIE_DOMAIN`; dashboard sessions are intentionally host-only.

## Deployments

A push to `main` replaces only the development Worker:

```bash
git push origin main
```

A stable SemVer tag pointing to a commit contained in `main` replaces only the
production Worker:

```bash
git tag -a v1.2.0 -m "v1.2.0"
git push origin v1.2.0
```

Tags with another format, or tags pointing outside `main`, fail before deployment.
Deployment concurrency cancels superseded development builds but never cancels a
production release.

## Local Cloudflare preview

From the repository root:

```bash
pnpm --filter catto-dashboard preview:cloudflare
```

The ordinary local development server remains available with:

```bash
pnpm --filter catto-dashboard dev
```

## Rollback

List and roll back an environment independently:

```bash
pnpm --dir dashboard exec wrangler versions list --env production
pnpm --dir dashboard exec wrangler rollback --env production
```

Replace `production` with `development` for the development Worker.
