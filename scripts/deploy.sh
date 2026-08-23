#!/bin/bash
set -euo pipefail

COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"
CURRENT_BRANCH="$(git branch --show-current)"
DEPLOY_VERSION="$(git rev-parse --short HEAD)"
HEALTH_URL="http://localhost:4000/api/health"
MAX_WAIT=60

# Export for docker compose build arg
export DEPLOY_VERSION

echo "=== Deploying catto @ ${DEPLOY_VERSION} (${CURRENT_BRANCH}) ==="

# 1. Pull latest code from current branch
git pull --ff-only origin "${CURRENT_BRANCH}"

# 2. Build images with version tag
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES build \
  --build-arg "DEPLOY_VERSION=${DEPLOY_VERSION}" bot watermark

# 3. Run database migrations
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES run --rm bot sh -c "pnpm prisma migrate deploy"

# 4. Recreate bot (Docker Compose handles stop -> start)
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES up -d --no-deps bot

# 5. Wait for health check
echo "Waiting for bot to become healthy..."
elapsed=0
while [ "$elapsed" -lt "$MAX_WAIT" ]; do
  if curl -sf "$HEALTH_URL" | grep -q '"status":"ok"'; then
    echo "Bot is healthy! (${elapsed}s)"
    break
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done

if [ "$elapsed" -ge "$MAX_WAIT" ]; then
  echo "ERROR: Bot did not become healthy within ${MAX_WAIT}s"
  # shellcheck disable=SC2086
  docker compose $COMPOSE_FILES logs --tail=50 bot
  exit 1
fi

# 6. Recreate watermark service if image changed (stateless, safe to restart)
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES up -d --no-deps watermark

# 7. Ensure Caddy is running
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES up -d --no-deps caddy

echo "=== Deploy complete: ${DEPLOY_VERSION} ==="
