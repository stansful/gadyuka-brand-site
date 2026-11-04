#!/usr/bin/env bash
set -euo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-/backups}"
PENDING_DIR="${BACKUP_DIR}/pending"
BACKUP_CHUNK_BYTES="${BACKUP_CHUNK_BYTES:-47185920}"
TELEGRAM_API_URL="${TELEGRAM_API_URL:-https://api.telegram.org}"
TELEGRAM_DRY_RUN="${TELEGRAM_DRY_RUN:-0}"

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() {
  printf '[%s] ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
  exit 1
}

mkdir -p "${PENDING_DIR}"
chmod 700 "${BACKUP_DIR}" "${PENDING_DIR}"
exec 9>"${BACKUP_DIR}/.lock"
if ! flock -n 9; then
  log "another backup is already running; skipping this run"
  exit 0
fi

if [ "${TELEGRAM_DRY_RUN}" != "1" ]; then
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] || die "TELEGRAM_BOT_TOKEN is not configured"
  [ -n "${TELEGRAM_OWNER_ID:-}" ] || die "TELEGRAM_OWNER_ID is not configured"
fi

send_file() {
  local file="$1" index="$2" total="$3" response code curl_status=0 description
  response="${WORK}/telegram-response.json"
  rm -f "${response}"
  code="$(curl --silent --show-error \
    --connect-timeout 15 --max-time 900 \
    --retry 2 --retry-delay 2 --retry-all-errors \
    --output "${response}" --write-out '%{http_code}' \
    --form-string "chat_id=${TELEGRAM_OWNER_ID}" \
    --form-string "caption=ГАДЮКА: бэкап $(basename "$(dirname "${file}")"), файл ${index}/${total}" \
    --form "document=@${file}" \
    "${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/sendDocument")" || curl_status=$?
  if [ "${curl_status}" -ne 0 ]; then
    log "Telegram upload failed for $(basename "${file}") (curl ${curl_status}); the archive is kept"
    return 1
  fi
  if [ "${code}" != "200" ] || ! jq -e '.ok == true' "${response}" >/dev/null 2>&1; then
    description="$(jq -r '.description // empty' "${response}" 2>/dev/null || true)"
    log "Telegram rejected $(basename "${file}") (HTTP ${code:-unknown}): ${description:-unexpected response}; the archive is kept"
    return 1
  fi
  touch "${file}.sent"
  log "Telegram accepted $(basename "${file}") (${index}/${total})"
}

split_archive() {
  local directory="$1" archive_name="$2" archive_path archive_size split_dir
  archive_path="${directory}/${archive_name}"
  [ -f "${archive_path}" ] || return 0
  archive_size="$(wc -c <"${archive_path}" | tr -d '[:space:]')"
  if [ "${archive_size}" -le "${BACKUP_CHUNK_BYTES}" ]; then return 0; fi

  split_dir="${WORK}/split"
  rm -rf -- "${split_dir}"
  mkdir "${split_dir}"
  if ! split -b "${BACKUP_CHUNK_BYTES}" -d -a 3 "${archive_path}" "${split_dir}/${archive_name}."; then
    log "could not split ${archive_name}; the complete archive is kept"
    return 1
  fi
  mv "${split_dir}/${archive_name}."* "${directory}/"
  rm -f -- "${archive_path}"
}

send_pending() {
  local directory archive_name files part total index=0
  for directory in "${PENDING_DIR}"/gadyuka-backup_*; do
    [ -d "${directory}" ] || continue
    archive_name="$(basename "${directory}").tar.gz"
    split_archive "${directory}" "${archive_name}"
    files="$(find "${directory}" -maxdepth 1 -type f \
      \( -name "${archive_name}" -o -name "${archive_name}.[0-9][0-9][0-9]" \) -print | LC_ALL=C sort)"
    total="$(printf '%s\n' "${files}" | awk 'NF { count += 1 } END { print count + 0 }')"
    if [ "${total}" -eq 0 ]; then
      log "WARNING: ${directory} has no archive parts; keeping it for manual inspection"
      return 1
    fi
    index=0
    while IFS= read -r part; do
      [ -n "${part}" ] || continue
      index=$((index + 1))
      if [ -f "${part}.sent" ]; then
        continue
      fi
      send_file "${part}" "${index}" "${total}" || return 1
    done <<EOF
${files}
EOF
    rm -rf -- "${directory}"
    log "backup delivered and removed from the server: ${archive_name}"
  done
}

STAMP="$(date -u +%Y-%m-%d_%H%M%S)"
DUMP_NAME="db_${STAMP}.dump"
ARCHIVE_NAME="gadyuka-backup_${STAMP}.tar.gz"
PENDING_NAME="${ARCHIVE_NAME%.tar.gz}"
PENDING_PATH="${PENDING_DIR}/${PENDING_NAME}"
WORK="$(mktemp -d "${BACKUP_DIR}/.work.XXXXXX")"
PARTIAL=""
READY=0
PENDING_CREATED=0
cleanup() {
  rm -rf -- "${WORK}"
  if [ -n "${PARTIAL}" ]; then rm -f -- "${PARTIAL}"; fi
  if [ "${READY}" -eq 0 ] && [ "${PENDING_CREATED}" -eq 1 ]; then rm -rf -- "${PENDING_PATH}"; fi
}
trap cleanup EXIT

mkdir "${PENDING_PATH}"
PENDING_CREATED=1
log "creating ${ARCHIVE_NAME}"
PGPASSWORD="${POSTGRES_PASS}" pg_dump \
  --host="${POSTGRES_HOST:-postgres}" \
  --port="${POSTGRES_PORT:-5432}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_NAME}" \
  --format=custom >"${WORK}/${DUMP_NAME}"
[ -s "${WORK}/${DUMP_NAME}" ] || die "pg_dump produced an empty dump"

export MC_CONFIG_DIR="${WORK}/mc-config"
mc alias set local "http://${MINIO_HOST:-minio}:${MINIO_PORT:-9000}" \
  "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" >/dev/null
mkdir "${WORK}/media"
mc mirror --quiet --overwrite "local/${S3_BUCKET}" "${WORK}/media" >/dev/null

PARTIAL="${PENDING_PATH}/${ARCHIVE_NAME}.partial"
tar -C "${WORK}" -czf "${PARTIAL}" "${DUMP_NAME}" media
mv "${PARTIAL}" "${PENDING_PATH}/${ARCHIVE_NAME}"
PARTIAL=""
ARCHIVE_PATH="${PENDING_PATH}/${ARCHIVE_NAME}"
ARCHIVE_SIZE="$(wc -c <"${ARCHIVE_PATH}" | tr -d '[:space:]')"
READY=1
log "archive ready: ${ARCHIVE_NAME} (${ARCHIVE_SIZE} bytes)"

if [ "${TELEGRAM_DRY_RUN}" = "1" ]; then
  log "TELEGRAM_DRY_RUN=1: nothing sent; the archive is kept in ${PENDING_PATH}"
  exit 0
fi

send_pending
