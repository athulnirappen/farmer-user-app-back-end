#!/usr/bin/env bash
# Pulls the latest code, rebuilds, backs up, migrates and restarts. Run on the server.
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; . ./.env.production; set +a
compose() { docker compose -f docker-compose.prod.yml "$@"; }

git pull --ff-only
git -C ../admin-web pull --ff-only

# Built in a throwaway container so the server doesn't need Node installed
docker run --rm -v "$(cd ../admin-web && pwd)":/app -w /app \
  -e VITE_API_ORIGIN="https://$API_DOMAIN" \
  node:22-alpine sh -c "npm ci && npm run build"

compose build api migrate
compose up -d postgres

# Back up before migrating, unless this is the very first deploy
if compose ps --services --status running | grep -qx api; then
  ./deploy/backup.sh
fi

compose run --rm migrate
compose up -d api caddy

echo "Deployed. Health: $(curl -s -o /dev/null -w '%{http_code}' "https://$API_DOMAIN/api/v1/health")"
