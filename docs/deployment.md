# Deployment Guide (Legacy - GitHub Actions CD)

> **⚠️ This guide documents the legacy GitHub Actions CD approach.**
>
> **For new deployments, use [Dokploy](./deployment-dokploy.md)** which provides:
>
> - Web UI for logs and management
> - Zero-downtime deployments
> - Automatic SSL via Traefik
> - One-click rollbacks
> - Built-in notifications
>
> This guide remains for reference or if you prefer the manual approach.

## Overview

Catto supports **two deployment environments**:

| Environment     | Branch | Path             | Domain                   | Purpose                            |
| --------------- | ------ | ---------------- | ------------------------ | ---------------------------------- |
| **Production**  | `main` | `/opt/catto`     | `api.yourdomain.com`     | Stable releases for end users      |
| **Development** | `dev`  | `/opt/catto-dev` | `api-dev.yourdomain.com` | Testing and pre-release validation |

Both environments auto-deploy via GitHub Actions on push. They can run on the same server (different directories/ports) or separate servers.

## Prerequisites

- Docker & Docker Compose v2+
- Git
- A domain with DNS A record pointing to your server
- SSH access to the server

## Initial Server Setup (Production)

The following steps set up **production only**. For dual dev/prod setup on the same server, see the [Same Server Setup](#same-server-setup-recommended-for-small-teams) section under Automated Deploys.

### 1. Clone the repository

```bash
sudo mkdir -p /opt/catto
sudo chown $USER:$USER /opt/catto
git clone -b main git@github.com:your-org/catto.git /opt/catto
cd /opt/catto
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your secrets (DISCORD_TOKEN, DATABASE_URL, etc.)
```

### 3. Configure Caddy domain

Set your domain and ACME email in `.env` or export them:

```bash
# Add to .env or export before running docker compose
CADDY_DOMAIN=api.yourdomain.com
CADDY_ACME_EMAIL=your@email.com
```

Caddy auto-provisions Let's Encrypt SSL certificates.

### 4. Start services

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 5. Run initial database migration

```bash
docker compose exec bot pnpm prisma migrate deploy
```

### 6. Verify

```bash
curl https://api.yourdomain.com/api/health
```

You should see:

```json
{
  "status": "ok",
  "version": "dev",
  "guilds": 0,
  "gateway": 0,
  "redis": "connected",
  "postgres": "connected"
}
```

## Automated Deploys (GitHub Actions)

The CD pipeline supports **two environments**:

- **Development**: Auto-deploys on push to `dev` branch → `/opt/catto-dev`
- **Production**: Auto-deploys on push to `main` branch → `/opt/catto`

Both environments can run on the same server (different directories) or different servers entirely.

### Required GitHub Secrets

Configure secrets per environment at **Settings > Secrets and variables > Actions**:

#### Development Environment (dev branch)

| Secret                | Description                                   |
| --------------------- | --------------------------------------------- |
| `SERVER_HOST_DEV`     | Dev server IP or hostname                     |
| `SERVER_USER_DEV`     | SSH username for dev                          |
| `SSH_PRIVATE_KEY_DEV` | SSH private key for dev (ed25519 recommended) |
| `SERVER_PORT_DEV`     | SSH port (optional, defaults to 22)           |

#### Production Environment (main branch)

| Secret                 | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `SERVER_HOST_PROD`     | Production server IP or hostname                     |
| `SERVER_USER_PROD`     | SSH username for production                          |
| `SSH_PRIVATE_KEY_PROD` | SSH private key for production (ed25519 recommended) |
| `SERVER_PORT_PROD`     | SSH port (optional, defaults to 22)                  |

### Same Server Setup (Recommended for Small Teams)

If using the same server for both environments, you must **manually set up both directories once**. After that, the CD pipeline auto-pulls on each deploy.

```bash
# Clone dev environment
sudo mkdir -p /opt/catto-dev
sudo chown $USER:$USER /opt/catto-dev
git clone -b dev git@github.com:your-org/catto.git /opt/catto-dev
cd /opt/catto-dev
cp .env.example .env
# Edit .env with dev-specific config (different ports, dev database, etc.)

# Clone production environment
sudo mkdir -p /opt/catto
sudo chown $USER:$USER /opt/catto
git clone -b main git@github.com:your-org/catto.git /opt/catto
cd /opt/catto
cp .env.example .env
# Edit .env with production config
```

**Important:** The deploy script auto-detects the current branch and pulls from `origin <branch>`, so:

- `/opt/catto-dev` must be on the `dev` branch
- `/opt/catto` must be on the `main` branch

Set the same SSH credentials for both environments in GitHub secrets (same `SERVER_HOST`, `SERVER_USER`, `SSH_PRIVATE_KEY`).

### How it Works

1. Push to `dev` or `main` triggers CI (lint, typecheck, test)
2. If CI passes, CD SSHs into the server and runs `scripts/deploy.sh` in the appropriate directory
3. The script pulls code, builds images, recreates the bot container, and waits for health check
4. If the health check fails within 60s, the deploy is marked as failed
5. Dev and production deploys run independently (separate concurrency groups)

### Optional: Deploy Protection (paid plans only)

GitHub Actions [environments](https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment) allow adding required reviewers and wait timers before deploys run. This requires **GitHub Pro, Team, or Enterprise** for private repos.

To enable:

1. Go to **Settings > Environments**, create `production` and `development` environments
2. Add protection rules (required reviewers, wait timer, etc.)
3. Add <code v-pre>environment: ${{ steps.env.outputs.env_name }}</code> to the `deploy` job in `.github/workflows/cd.yml`

## Manual Deploy

```bash
# Production
ssh your-server 'cd /opt/catto && bash scripts/deploy.sh'

# Development
ssh your-server 'cd /opt/catto-dev && bash scripts/deploy.sh'
```

## Environment Configuration

When running dev and prod on the same server, ensure they don't conflict:

### Port Allocation

In `/opt/catto-dev/.env`:

```bash
# Dev uses different ports
API_PORT=4001
POSTGRES_PORT=5433
REDIS_PORT=6380
WATERMARK_SERVICE_PORT=3848

# Dev Caddy domain
CADDY_DOMAIN=api-dev.yourdomain.com
CADDY_ACME_EMAIL=your@email.com
```

In `/opt/catto/.env` (production):

```bash
# Production uses default ports
API_PORT=4000
POSTGRES_PORT=5432
REDIS_PORT=6379
WATERMARK_SERVICE_PORT=3847

# Production Caddy domain
CADDY_DOMAIN=api.yourdomain.com
CADDY_ACME_EMAIL=your@email.com
```

### Caddy Configuration (Same Server Only)

When running both environments on the same server, **only run Caddy in production**. The dev environment should be accessed directly or share production's Caddy.

**Option 1: Direct access (no SSL for dev)**

```bash
# Access dev bot directly via port
curl http://your-server:4001/api/health
```

**Option 2: Shared Caddy (recommended)**

Disable Caddy in dev's docker-compose:

```bash
# In /opt/catto-dev, create docker-compose.override.yml
cat > docker-compose.override.yml << 'EOF'
services:
  caddy:
    profiles: [disabled]
EOF
```

Add dev domain to production's Caddyfile:

```caddyfile
# In /opt/catto/Caddyfile
api.yourdomain.com {
    reverse_proxy bot:4000
    # ... existing config
}

api-dev.yourdomain.com {
    reverse_proxy localhost:4001
    encode gzip
    header {
        -Server
        X-Content-Type-Options "nosniff"
    }
}
```

Ensure both `api.yourdomain.com` and `api-dev.yourdomain.com` have DNS A records pointing to your server.

## Monitoring

### Logs

**Production:**

```bash
cd /opt/catto
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f bot
```

**Development:**

```bash
cd /opt/catto-dev
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f bot
```

### Health Check

**Production:**

```bash
curl -s https://api.yourdomain.com/api/health | jq .
```

**Development:**

```bash
curl -s https://api-dev.yourdomain.com/api/health | jq .
# Or direct access if no SSL:
curl -s http://your-server:4001/api/health | jq .
```

### Container Status

**Production:**

```bash
cd /opt/catto
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

**Development:**

```bash
cd /opt/catto-dev
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

## Rollback

### Via git revert (recommended)

**Production:**

```bash
git revert HEAD
git push origin main
# CD auto-deploys the reverted version
```

**Development:**

```bash
git revert HEAD
git push origin dev
# CD auto-deploys the reverted version
```

### Manual rollback to specific commit

**Production:**

```bash
ssh your-server 'cd /opt/catto && git checkout <sha> && bash scripts/deploy.sh'
```

**Development:**

```bash
ssh your-server 'cd /opt/catto-dev && git checkout <sha> && bash scripts/deploy.sh'
```

## Dashboard (Cloudflare Workers)

The Next.js dashboard deploys independently to Cloudflare Workers through the
OpenNext adapter:

- Pushes to `main` deploy the development dashboard at `dev.catto.one`.
- Stable SemVer tags deploy the tagged commit to production at `dash.catto.one`.
- Browser API requests use the dashboard origin and are proxied to the matching
  containerized API through the server-only `BOT_API_INTERNAL_URL` setting.

See [Dashboard deployment on Cloudflare](./deployment-cloudflare.md) for the
Wrangler environments, GitHub secrets, API settings, release process, and
rollback commands.

## Architecture Overview

```
Internet
   |
   v
Caddy (:80/:443, auto-SSL)
   |
   v
Bot (:4000, API + Discord Gateway)
   |
   +---> Redis 7 (cache, queues)
   +---> PostgreSQL 17 (data)
   +---> Watermark (Rust, image processing)
   +---> Image Gen (Rust, rank/leaderboard/bonk images)

Cloudflare Workers (dashboard, OpenNext)
   |
   +---> Bot API via HTTPS
```
