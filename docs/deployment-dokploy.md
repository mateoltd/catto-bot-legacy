# Deployment with Dokploy

## Overview

Dokploy provides a self-hosted deployment platform with:
- 🎯 Web UI for deployment management
- 📊 Real-time logs and container monitoring
- 🔄 One-click rollbacks
- 🔔 Discord/Slack notifications
- 🚀 Zero-downtime deployments
- 🌐 Automatic SSL via Traefik

## Architecture

```
GitHub (dev/main branches)
    ↓ (push triggers CI)
GitHub Actions
    ↓ (builds & pushes Docker image)
GitHub Container Registry (GHCR)
    ↓ (webhook on new image)
Dokploy
    ↓ (pulls image & deploys with zero downtime)
Docker Swarm (production containers)
    ↓
Traefik (auto-routing, auto-SSL)
```

**Supporting services** (postgres, redis, watermark) run on host via docker-compose and connect to Dokploy's bot via shared network.

---

## Prerequisites

- ✅ Dokploy installed on your server
- ✅ Domain with DNS configured
- ✅ GitHub repository access (GHCR is automatically available)

---

## Initial Setup

### 1. Create Docker Network

SSH into your server and create the shared network:

```bash
docker network create catto-network
```

This network allows Dokploy's bot containers to communicate with host services (postgres/redis/watermark).

### 2. Start Supporting Services

On your server, start the supporting services:

```bash
cd /path/to/catto/repo
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis watermark
```

Verify they're running:
```bash
docker ps | grep catto
docker exec catto-postgres psql -U postgres -l
docker exec catto-redis redis-cli ping
```

### 3. GitHub Container Registry

No setup needed! GHCR is automatically available for your repository.

- Images publish to: `ghcr.io/your-org/your-repo:tag`
- Uses built-in `GITHUB_TOKEN` (no secrets to configure)
- After first build, images appear in **Packages** tab on GitHub
- By default, packages are private (can be made public in package settings)

---

## Dokploy Configuration

### 4. Connect GitHub Source

1. In Dokploy dashboard: **Sources** → **Add Source**
2. Select **GitHub**
3. Authorize Dokploy to access your repository
4. Verify connection successful

### 5. Create Production Project

1. **Projects** → **New Project**
2. Name: `catto-production`
3. Description: "Production deployment - main branch"

### 6. Create Production Bot Resource

1. Inside project: **New Resource** → **Docker Image**
2. Configuration:
   - **Name**: `catto-bot-prod`
   - **Image**: `ghcr.io/your-org/your-repo:latest` (replace with your org/repo)
   - **Registry**: GitHub Container Registry
   - **Registry Credentials** (if package is private):
     - Username: your GitHub username
     - Password: Personal Access Token with `read:packages` scope
   - **Auto-deploy**: ✅ Enable
   - **Network**: Select `catto-network` (or configure in Advanced settings)

### 7. Configure Production Environment Variables

Go to **Environment Variables** tab and add all variables from `.env.dokploy.example`:

**Critical variables:**
```bash
DISCORD_TOKEN=your_production_token
DATABASE_URL=postgresql://postgres:password@postgres:5432/catto_prod?schema=public
REDIS_HOST=redis
REDIS_PASSWORD=your_redis_password
WATERMARK_SERVICE_URL=http://watermark:3847
SESSION_ENCRYPTION_KEY=your_32_char_hex
NODE_ENV=production
```

See `.env.dokploy.example` for the full list.

### 8. Configure Production Domain

1. **Domains** tab → **Add Domain**
2. Domain: `api.yourdomain.com`
3. Enable **HTTPS** (Traefik auto-configures Let's Encrypt)
4. Port: `4000`
5. Save

### 9. Configure Zero-Downtime Deployments

This is critical for production stability!

1. **Advanced** tab → **Cluster Settings** → **Swarm Settings**
2. Add **Health Check** JSON:

```json
{
  "Test": ["CMD", "curl", "-f", "http://localhost:4000/api/health"],
  "Interval": 30000000000,
  "Timeout": 10000000000,
  "StartPeriod": 40000000000,
  "Retries": 3
}
```

3. Add **Update Config** JSON:

```json
{
  "FailureAction": "rollback",
  "Order": "start-first"
}
```

This ensures:
- New container starts and passes health checks
- Traffic switches to new container
- Old container shuts down
- On failure, automatic rollback to previous version

---

## Development Environment

Repeat steps 5-9 for development:

**Project**: `catto-development`
**Resource**: `catto-bot-dev`
**Image**: `ghcr.io/your-org/your-repo:dev`
**Domain**: `api-dev.yourdomain.com`

**Environment variable differences:**
- `DISCORD_TOKEN` → dev bot (if separate)
- `DATABASE_URL` → `...@postgres:5432/catto_dev?schema=public`
- `REDIS_DB` → `1` (different Redis database)
- `DEPLOY_VERSION` → `dev`
- `API_REDIRECT` → `https://api-dev.yourdomain.com/api/oauth/callback`

---

## DNS Configuration

Configure DNS A records:
```
api.yourdomain.com      →  your_server_ip
api-dev.yourdomain.com  →  your_server_ip
```

Wait 5-60 minutes for propagation.

---

## First Deployment

### Production

1. Push code to `main` branch
2. GitHub Actions builds and pushes `ghcr.io/your-org/your-repo:latest` to GHCR
3. Dokploy receives webhook and pulls image
4. In Dokploy UI: watch deployment logs in real-time
5. Verify: `curl https://api.yourdomain.com/api/health`

### Development

1. Push code to `dev` branch
2. GitHub Actions builds and pushes `ghcr.io/your-org/your-repo:dev` to GHCR
3. Dokploy auto-deploys
4. Verify: `curl https://api-dev.yourdomain.com/api/health`

---

## Daily Operations

### Viewing Logs

- In Dokploy UI: navigate to resource → **Logs** tab
- Real-time streaming logs from all containers
- Filter by container if needed

### Manual Deployment

- Click **Deploy** button in resource view
- Optionally specify a different image tag
- Watch deployment progress in logs

### Rollback

1. Go to **Deployments** history tab
2. Find a previous successful deployment
3. Click **Redeploy**
4. Zero-downtime rollback to that version

### Notifications

1. Project settings → **Notifications**
2. Add Discord/Slack webhook URL
3. Enable for: deployment started, succeeded, failed

---

## Deployment Flow

```
1. Developer pushes to main/dev branch
        ↓
2. GitHub Actions CI runs (lint, test, typecheck)
        ↓
3. CI builds Docker image with tag (latest or dev)
        ↓
4. CI pushes image to GitHub Container Registry
        ↓
5. Dokploy receives webhook from GHCR
        ↓
6. Dokploy pulls new image
        ↓
7. Dokploy starts new container in Swarm
        ↓
8. Health checks pass on new container
        ↓
9. Traefik switches traffic to new container (zero downtime!)
        ↓
10. Old container gracefully shuts down
        ↓
11. Discord notification: "Deploy successful 🚀"
```

---

## Troubleshooting

### Deployment Fails

**Check:**
- Deployment logs in Dokploy UI
- Image exists on GHCR: Go to GitHub repo → **Packages** tab
- Or try: `docker pull ghcr.io/your-org/your-repo:latest`
- Environment variables are correct
- Docker network: `docker network inspect catto-network`
- If package is private, verify Dokploy has valid GHCR credentials

### Health Check Fails

**Check:**
- Bot logs in Dokploy: look for startup errors
- Health endpoint responds: `curl http://localhost:4000/api/health`
- Redis connectivity: `docker exec catto-redis redis-cli ping`
- Postgres connectivity: `docker exec catto-postgres psql -U postgres -l`

**Common issues:**
- Wrong `DATABASE_URL` (check hostname is `postgres` not `localhost`)
- Wrong `REDIS_HOST` (should be `redis` not `localhost`)
- Missing environment variables
- Wrong network configuration

### Domain/SSL Issues

**Check:**
- DNS propagation: `dig api.yourdomain.com` (should show server IP)
- Port 80/443 open: `sudo ufw status` or check cloud provider firewall
- Traefik logs in Dokploy
- Domain correctly configured in Dokploy UI

### Auto-Deploy Not Triggering

**Check:**
- Image was pushed to GHCR successfully (check GitHub Actions logs)
- Image appears in GitHub repo → **Packages** tab
- Auto-deploy is enabled in Dokploy resource settings
- Image name matches exactly (including `ghcr.io/` prefix and tag)
- Dokploy webhook is configured for GHCR
- If package is private, verify Dokploy can authenticate to GHCR

### Bot Can't Connect to Postgres/Redis

**Check:**
- Services are running: `docker ps | grep catto`
- Services are on `catto-network`: `docker network inspect catto-network`
- Dokploy bot is also on `catto-network` (configure in Advanced settings)
- Hostnames are correct: `postgres`, `redis`, `watermark` (not `localhost`)

---

## Migration from GitHub Actions CD

If you're migrating from the old GitHub Actions CD approach:

1. ✅ GitHub Actions CI still runs (builds images now instead of deploying)
2. ✅ Supporting services stay on host (no change needed)
3. ❌ Old `.github/workflows/cd.yml` archived (Dokploy handles deployment)
4. ❌ Caddy removed (Traefik replaces it)
5. ❌ `scripts/deploy.sh` no longer needed

Your docker-compose supporting services continue running as before, just the bot deployment method changed.

---

## Advanced: Zero-Downtime Deep Dive

Dokploy uses Docker Swarm's rolling update strategy:

1. **start-first**: New container starts before old one stops
2. **Health check**: New container must pass health checks
3. **Timeout**: 40s start period for app warmup
4. **Retries**: 3 attempts before marking unhealthy
5. **Rollback**: On failure, automatically reverts to previous version

This ensures your API stays responsive during deploys - no 5-10s Gateway disconnect window!

---

## Resources

- [Dokploy Documentation](https://docs.dokploy.com)
- [Zero-Downtime Deployments](https://docs.dokploy.com/docs/core/applications/zero-downtime)
- [Docker Compose Integration](https://docs.dokploy.com/docs/core/docker-compose)
- [Auto-Deploy Setup](https://docs.dokploy.com/docs/core/auto-deploy)

---

## Phase 2: True Zero-Downtime (Future)

Dokploy's zero-downtime is good for HTTP APIs, but Discord Gateway connections still disconnect during container restarts.

For true Discord Gateway handoff (no events missed), the Phase 2 plan with Redis leader election and pub/sub handoff is still needed. This would be implemented as a pre-deployment script in Dokploy or as an external orchestration layer.

Current setup handles 99% of use cases - Gateway reconnects are fast (~2s) and BullMQ jobs survive container restarts.
