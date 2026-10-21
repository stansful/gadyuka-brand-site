#!/usr/bin/env bash
# ГАДЮКА — restore from deploy/backup.sh: the database from a dump and the media from the mirror.
# Works on the same server and on a fresh one (run up-caddy.sh / up-nginx.sh there first; its own .env is
# fine: the restored tables belong to this server's POSTGRES_USER and get this server's APP_DB_USER grants).
#
#   sudo ./deploy/restore.sh backups/db_2026-10-21_033000.dump [--yes]
#   (media from <dump folder>/media; another folder: MEDIA_DIR=/path)
#
# Steps: postgres + minio up → migrate (schema + the backend's role exist) → backend / frontend stopped →
# pg_restore --clean --if-exists --no-owner --no-acl (one transaction) → migrate again (grants of the
# backend's role, newer migrations) → media mirrored into the bucket (adds missing files, deletes
# nothing) → everything up again (the seed runs as on every start and keeps the restored data).
set -euo pipefail

# shellcheck source=deploy/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DUMP=""
ASSUME_YES=0
for arg in "$@"; do
  case "${arg}" in
    --yes) ASSUME_YES=1 ;;
    --skip-host-setup) SKIP_HOST_SETUP=1 ;;
    -*) die "unknown option: ${arg}" ;;
    *) DUMP="${arg}" ;;
  esac
done
[ -n "${DUMP}" ] || die "usage: $0 <db_….dump> [--yes]"
[ -f "${DUMP}" ] || die "no such dump: ${DUMP}"
DUMP="$(cd "$(dirname "${DUMP}")" && pwd)/$(basename "${DUMP}")"
MEDIA_DIR="${MEDIA_DIR:-$(dirname "${DUMP}")/media}"
[ -f "${ENV_FILE}" ] || die "no ${ENV_FILE}: deploy first (up-caddy.sh / up-nginx.sh), then restore"
docker info >/dev/null 2>&1 || die "cannot talk to Docker: run with sudo"
detect_proxy

if [ "${ASSUME_YES}" != "1" ]; then
  is_interactive || die "add --yes to restore without a question"
  printf 'The database will be REPLACED by %s. Type "yes" to continue: ' "${DUMP}"
  read -r answer
  [ "${answer}" = "yes" ] || die "cancelled"
fi

log "starting postgres and minio, applying migrations"
compose up -d --wait postgres minio
compose run --rm migrate
log "stopping the site while the database is replaced"
compose stop backend frontend
# shellcheck disable=SC2016 # expanded inside the container
compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl --single-transaction' <"${DUMP}"
compose run --rm migrate

if [ -d "${MEDIA_DIR}" ]; then
  log "restoring media from ${MEDIA_DIR}"
  compose up -d minio-init
  # shellcheck disable=SC2016 # expanded inside the container
  compose run --rm --no-deps -T -e MC_CONFIG_DIR=/tmp/mc -v "${MEDIA_DIR}:/backup/media:ro" \
    --entrypoint /bin/sh minio-init -c \
    'mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null &&
     mc mb --ignore-existing "local/$S3_BUCKET" >/dev/null &&
     mc mirror --quiet --overwrite /backup/media "local/$S3_BUCKET" >/dev/null'
else
  warn "no media folder ${MEDIA_DIR}: images were not restored"
fi

log "starting everything"
compose up -d --remove-orphans --wait --wait-timeout "${WAIT_TIMEOUT:-600}" || show_failure
log "restored from ${DUMP}. Save any record in the admin once to refresh the site's caches."
