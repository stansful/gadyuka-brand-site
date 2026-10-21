#!/usr/bin/env bash
# ГАДЮКА — backup: a PostgreSQL dump (pg_dump -Fc; dumps older than KEEP_DAYS=14 days are deleted) and a
# mirror of the MinIO media bucket as plain files (append-only: keys never change, so the mirror has the
# images of every kept dump, even ones deleted later in the admin).
#
#   sudo ./deploy/backup.sh                        → <repo>/backups/db_<date>.dump + backups/media/
#   sudo BACKUP_DIR=/srv/backups ./deploy/backup.sh
#
# Daily at 03:30 (root crontab: `sudo crontab -e`):
#   30 3 * * * /opt/gadyuka/deploy/backup.sh >> /var/log/gadyuka-backup.log 2>&1
#
# The dumps hold every lead (names, phones, e-mails): files are created with umask 077 in a 700 folder.
# Copies on the same server do not survive losing the server — pull them off regularly (rsync / rclone).
# Restore: deploy/restore.sh.
set -euo pipefail
umask 077

# shellcheck source=deploy/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ -f "${ENV_FILE}" ] || die "no ${ENV_FILE}: nothing was deployed from this folder"
docker info >/dev/null 2>&1 || die "cannot talk to Docker: run with sudo"
detect_proxy

BACKUP_DIR="${BACKUP_DIR:-${REPO_DIR}/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
DUMP="${BACKUP_DIR}/db_${STAMP}.dump"

mkdir -p "${BACKUP_DIR}/media"
chmod 700 "${BACKUP_DIR}"
trap 'rm -f "${DUMP}.partial"' EXIT

# shellcheck disable=SC2016 # expanded inside the container
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' >"${DUMP}.partial"
mv "${DUMP}.partial" "${DUMP}"

# Media: a one-off container of the minio-init service (root MinIO credentials, the data network),
# running as the caller so the files belong to them.
# shellcheck disable=SC2016 # expanded inside the container
compose run --rm --no-deps -T -u "$(id -u):$(id -g)" -e MC_CONFIG_DIR=/tmp/mc \
  -v "${BACKUP_DIR}/media:/backup/media" --entrypoint /bin/sh minio-init -c \
  'mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null &&
   mc mirror --quiet --overwrite "local/$S3_BUCKET" /backup/media >/dev/null'

find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'db_*.dump' -mtime "+${KEEP_DAYS}" -delete
log "backup ok: ${DUMP} ($(du -h "${DUMP}" | cut -f 1)); media: ${BACKUP_DIR}/media ($(du -sh "${BACKUP_DIR}/media" | cut -f 1))"
