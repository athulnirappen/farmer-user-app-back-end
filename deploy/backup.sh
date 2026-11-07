#!/usr/bin/env bash
# Dumps the database and the uploaded images, keeping 7 days. Run nightly from cron.
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; . ./.env.production; set +a
compose() { docker compose -f docker-compose.prod.yml "$@"; }

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
mkdir -p "$BACKUP_DIR"
stamp="$(date +%Y%m%d-%H%M%S)"

compose exec -T postgres pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > "$BACKUP_DIR/db-$stamp.dump"
compose run --rm --no-deps -T --entrypoint tar api -czf - -C /app uploads > "$BACKUP_DIR/uploads-$stamp.tar.gz"

find "$BACKUP_DIR" -type f -mtime +7 -delete

# A copy on this server is lost with the server; copy it off once rclone is set up:
# rclone copy "$BACKUP_DIR" gdrive:farmer-backups

echo "Backup written to $BACKUP_DIR ($stamp)"
