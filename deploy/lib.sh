#!/usr/bin/env bash
# ГАДЮКА — shared functions of deploy/up-caddy.sh, deploy/up-nginx.sh, deploy/down.sh and deploy/backup.sh.
# Sourced, never executed. Written for bash on Debian / Ubuntu (also runs on bash 3.2 for the
# --skip-host-setup local test mode).

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${GADYUKA_ENV_FILE:-${REPO_DIR}/.env}"
ENV_EXAMPLE="${REPO_DIR}/.env.example"

# Variables the scripts accept from the environment on a first run (non-interactive use) — also kept
# across the sudo re-exec.
PRESERVED_VARS="DOMAIN LETSENCRYPT_EMAIL ADMIN_LOGIN ADMIN_PASSWORD TELEGRAM_BOT_TOKEN TELEGRAM_OWNER_ID VOLUMES_DIR HTTP_PORT HTTPS_PORT SITE_URL GADYUKA_ENV_FILE BACKUP_DIR BACKUP_SCHEDULE BACKUP_TIMEZONE COMPOSE_PROJECT_NAME"

# Secrets generated on the first run: name and `openssl rand -hex` byte count. Hex only: safe in URLs,
# shell commands and `mc` without quoting.
SECRET_SPECS="POSTGRES_PASS:24 APP_DB_PASSWORD:24 MINIO_ROOT_PASSWORD:24 S3_SECRET_ACCESS_KEY:24 INTERNAL_API_KEY:32 AUTH_ACCESS_SECRET:32 IP_HASH_SALT:32"

# uid:gid of the processes that write each data folder (official images: postgres:alpine = 70,
# node = 1000, minio / caddy / nginx master / certbot = root) and the folder's mode.
VOLUME_SPECS="postgres:70:70:700 minio:0:0:700 backups:0:0:700 backend/logs:1000:1000:750 frontend/cache:1000:1000:755 frontend/static:1000:1000:755"
CADDY_VOLUME_SPECS="caddy/data:0:0:700 caddy/config:0:0:700"
NGINX_VOLUME_SPECS="nginx/certs:0:0:700 certbot/www:0:0:755"

SKIP_HOST_SETUP=0
GENERATED_ADMIN_PASSWORD=""

if [ -t 1 ]; then
  C_INFO=$'\033[1;32m' C_WARN=$'\033[1;33m' C_ERR=$'\033[1;31m' C_OFF=$'\033[0m'
else
  C_INFO="" C_WARN="" C_ERR="" C_OFF=""
fi

log() { printf '%s==>%s %s\n' "${C_INFO}" "${C_OFF}" "$*"; }
warn() { printf '%sWARNING:%s %s\n' "${C_WARN}" "${C_OFF}" "$*" >&2; }
die() {
  printf '%sERROR:%s %s\n' "${C_ERR}" "${C_OFF}" "$*" >&2
  exit 1
}

# ── host ──────────────────────────────────────────────────────────────────────────────────────────

# Re-runs the calling script through sudo when not root (keeps the first-run variables).
ensure_root() {
  [ "${SKIP_HOST_SETUP}" = "1" ] && return 0
  [ "$(id -u)" -eq 0 ] && return 0
  command -v sudo >/dev/null 2>&1 || die "run this script as root (sudo is not installed)"
  local keep="" name
  for name in ${PRESERVED_VARS}; do
    if [ -n "${!name+x}" ]; then keep="${keep:+${keep},}${name}"; fi
  done
  log "root rights are needed (Docker, data folders): re-running with sudo"
  if [ -n "${keep}" ]; then
    exec sudo --preserve-env="${keep}" bash "$0" "$@"
  fi
  exec sudo bash "$0" "$@"
}

# The user who started the script (through sudo or directly) and their home: VOLUMES_DIR defaults to
# <home>/docker-volumes/gadyuka of THAT user, not of root.
detect_target_user() {
  TARGET_USER="${SUDO_USER:-$(id -un)}"
  if [ "${SKIP_HOST_SETUP}" = "1" ] || ! command -v getent >/dev/null 2>&1; then
    TARGET_HOME="${HOME}"
  else
    TARGET_HOME="$(getent passwd "${TARGET_USER}" | cut -d : -f 6)"
  fi
  [ -n "${TARGET_HOME}" ] || die "cannot find the home directory of ${TARGET_USER}"
}

check_os() {
  [ "${SKIP_HOST_SETUP}" = "1" ] && return 0
  [ -r /etc/os-release ] || die "Debian or Ubuntu is required (no /etc/os-release)"
  # shellcheck disable=SC1091
  . /etc/os-release
  case " ${ID:-} ${ID_LIKE:-} " in
    *" ubuntu "*)
      DOCKER_DISTRO=ubuntu
      DISTRO_CODENAME="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
      ;;
    *" debian "*)
      DOCKER_DISTRO=debian
      DISTRO_CODENAME="${VERSION_CODENAME:-}"
      ;;
    *) die "Debian or Ubuntu is required, found: ${PRETTY_NAME:-unknown}" ;;
  esac
  [ -n "${DISTRO_CODENAME}" ] || die "cannot read the release codename from /etc/os-release"
  log "system: ${PRETTY_NAME:-${ID}} (${DOCKER_DISTRO} ${DISTRO_CODENAME})"
}

apt_install() {
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q --no-install-recommends "$@"
}

ensure_packages() {
  [ "${SKIP_HOST_SETUP}" = "1" ] && return 0
  local missing="" tool
  for tool in curl openssl; do
    command -v "${tool}" >/dev/null 2>&1 || missing="${missing} ${tool}"
  done
  [ -f /etc/ssl/certs/ca-certificates.crt ] || missing="${missing} ca-certificates"
  [ -z "${missing}" ] && return 0
  log "installing:${missing}"
  apt-get update -q
  # shellcheck disable=SC2086
  apt_install ${missing}
}

# Docker Engine + compose plugin from Docker's official apt repository (docs.docker.com/engine/install).
install_docker() {
  log "installing Docker Engine and the compose plugin (download.docker.com, ${DOCKER_DISTRO} ${DISTRO_CODENAME})"
  apt-get update -q
  apt_install ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${DOCKER_DISTRO}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/${DOCKER_DISTRO}
Suites: ${DISTRO_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update -q
  apt_install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    systemctl enable --now docker
  fi
}

ensure_docker() {
  if [ "${SKIP_HOST_SETUP}" = "1" ]; then
    docker compose version >/dev/null 2>&1 || die "docker compose is not available"
    return 0
  fi
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 &&
    docker buildx version >/dev/null 2>&1; then
    log "Docker: $(docker --version | sed 's/,.*//'), $(docker compose version --short 2>/dev/null || echo compose)"
  else
    if command -v docker >/dev/null 2>&1 && ! dpkg -s docker-ce >/dev/null 2>&1; then
      warn "docker is installed but not from Docker's repository (no compose / buildx plugin) — adding them"
    fi
    install_docker || die "Docker installation failed. If the distribution's docker.io is installed, remove it first: apt-get remove docker.io docker-compose docker-compose-v2 podman-docker containerd runc"
  fi
  docker info >/dev/null 2>&1 || die "the Docker daemon is not running (systemctl status docker)"
}

check_memory() {
  [ -r /proc/meminfo ] || return 0
  local mem swap
  mem="$(awk '/^MemTotal:/ {print int($2 / 1024)}' /proc/meminfo)"
  swap="$(awk '/^SwapTotal:/ {print int($2 / 1024)}' /proc/meminfo)"
  if [ $((mem + swap)) -lt 3500 ]; then
    warn "RAM ${mem} MiB + swap ${swap} MiB: building the images may run out of memory. Add swap first:"
    warn "  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab"
  fi
}

# Ports 80/443 must be free (or already ours: docker-proxy).
check_ports() {
  [ "${SKIP_HOST_SETUP}" = "1" ] && return 0
  command -v ss >/dev/null 2>&1 || return 0
  local port line http https
  http="$(env_get HTTP_PORT)" https="$(env_get HTTPS_PORT)"
  for port in "${http:-80}" "${https:-443}"; do
    line="$(ss -H -ltnp "sport = :${port}" 2>/dev/null | head -n 1)"
    if [ -n "${line}" ] && ! printf '%s' "${line}" | grep -q 'docker-proxy'; then
      die "port ${port} is already in use: ${line} — stop that web server first (e.g. systemctl disable --now apache2 nginx)"
    fi
  done
}

# ── .env ──────────────────────────────────────────────────────────────────────────────────────────

# Value of KEY in .env (last assignment wins; surrounding quotes removed), empty when absent.
env_get() {
  [ -f "${ENV_FILE}" ] || return 0
  local line value
  line="$(grep -E "^[[:space:]]*$1=" "${ENV_FILE}" | tail -n 1)" || true
  value="${line#*=}"
  case "${value}" in
    \"*\") value="${value#\"}" value="${value%\"}" ;;
    \'*\') value="${value#\'}" value="${value%\'}" ;;
  esac
  printf '%s' "${value}"
}

# Sets KEY=VALUE in .env (replaces the first assignment, appends when absent). The value is passed
# through the environment, so no character of it is interpreted.
env_set() {
  local tmp
  tmp="$(mktemp "${ENV_FILE}.XXXXXX")"
  ENV_KEY="$1" ENV_VALUE="$2" awk '
    BEGIN { key = ENVIRON["ENV_KEY"]; value = ENVIRON["ENV_VALUE"]; done = 0 }
    index($0, key "=") == 1 { if (!done) { print key "=" value; done = 1 }; next }
    { print }
    END { if (!done) print key "=" value }
  ' "${ENV_FILE}" >"${tmp}"
  chmod 600 "${tmp}"
  mv "${tmp}" "${ENV_FILE}"
}

random_hex() { openssl rand -hex "$1"; }

# 24 characters of [A-Za-z0-9] (≥ 16 required by the backend).
random_password() {
  local value=""
  while [ "${#value}" -lt 24 ]; do
    value="${value}$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9')"
  done
  printf '%s' "${value:0:24}"
}

is_interactive() { [ -t 0 ] && [ -t 1 ]; }

# ask VAR "question" [default] [secret]: keeps an exported value of VAR, else asks (TTY only).
ask() {
  local name="$1" question="$2" default="${3:-}" secret="${4:-}" answer=""
  if [ -n "${!name:-}" ]; then
    return 0
  fi
  if ! is_interactive; then
    printf -v "${name}" '%s' "${default}"
    return 0
  fi
  if [ "${secret}" = "secret" ]; then
    read -r -s -p "${question}: " answer
    printf '\n'
  elif [ -n "${default}" ]; then
    read -r -p "${question} [${default}]: " answer
  else
    read -r -p "${question}: " answer
  fi
  printf -v "${name}" '%s' "${answer:-${default}}"
}

valid_domain() {
  [ "$1" = "localhost" ] || printf '%s' "$1" | grep -Eq '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$'
}

valid_email() { printf '%s' "$1" | grep -Eq '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'; }

# 0 when the value holds a character Docker Compose changes or cuts in an unquoted .env value.
compose_unsafe() {
  case "$1" in
    *'$'* | *'"'* | *"'"* | *\\* | *'`'* | *[[:space:]]*) return 0 ;;
  esac
  return 1
}

valid_login() { printf '%s' "$1" | grep -Eq '^[a-z0-9._@-]{3,64}$'; }

site_url_for() {
  if [ "${HTTPS_PORT:-443}" = "443" ]; then printf 'https://%s' "$1"; else printf 'https://%s:%s' "$1" "${HTTPS_PORT}"; fi
}

first_run_help() {
  cat >&2 <<EOF
No .env yet and no terminal to ask in. Either run the script interactively, or pass the values:
  sudo DOMAIN=example.com ADMIN_LOGIN=admin [ADMIN_PASSWORD=…] [TELEGRAM_BOT_TOKEN=… TELEGRAM_OWNER_ID=…] \\
       $1 $0
or create .env yourself from .env.example (readme_dev.md, «Переменные окружения»).
EOF
  exit 1
}

# First run: .env from .env.example with generated secrets and the answers to a few questions.
create_env() {
  local proxy="$1" spec name bytes
  [ -f "${ENV_EXAMPLE}" ] || die "missing ${ENV_EXAMPLE}"
  log "first run: creating ${ENV_FILE}"
  if ! is_interactive && [ -z "${DOMAIN:-}" ]; then
    first_run_help "$([ "${proxy}" = nginx ] && echo 'LETSENCRYPT_EMAIL=you@example.com')"
  fi
  ask DOMAIN "Домен сайта (A-запись уже указывает на этот сервер), например gadyuka.ru"
  DOMAIN="$(printf '%s' "${DOMAIN}" | tr '[:upper:]' '[:lower:]')"
  valid_domain "${DOMAIN}" || die "invalid domain: ${DOMAIN}"
  if [ "${proxy}" = "nginx" ] && [ "${NGINX_TLS_MODE_WANTED:-letsencrypt}" = "letsencrypt" ]; then
    ask LETSENCRYPT_EMAIL "E-mail для Let's Encrypt (аккаунт сертификатов)"
    valid_email "${LETSENCRYPT_EMAIL:-}" || die "invalid or empty LETSENCRYPT_EMAIL"
  fi
  ask ADMIN_LOGIN "Логин администратора" "admin"
  ADMIN_LOGIN="$(printf '%s' "${ADMIN_LOGIN}" | tr '[:upper:]' '[:lower:]')"
  valid_login "${ADMIN_LOGIN}" || die "invalid admin login (3–64 of a-z 0-9 . _ @ -)"
  ask ADMIN_PASSWORD "Пароль администратора (не короче 16 символов; Enter — сгенерировать)" "" secret
  if [ -z "${ADMIN_PASSWORD}" ]; then
    ADMIN_PASSWORD="$(random_password)"
    GENERATED_ADMIN_PASSWORD="${ADMIN_PASSWORD}"
  fi
  [ "${#ADMIN_PASSWORD}" -ge 16 ] || die "the admin password must have at least 16 characters"
  if compose_unsafe "${ADMIN_PASSWORD}"; then
    die "the admin password must not contain \$, quotes, backslash, backtick or spaces (Docker Compose would change it)"
  fi
  ask TELEGRAM_BOT_TOKEN "Токен Telegram-бота для заявок (Enter — пропустить)" "" secret
  if [ -n "${TELEGRAM_BOT_TOKEN}" ]; then
    ask TELEGRAM_OWNER_ID "Chat id, куда бот пишет заявки"
  fi

  # The template holds no secrets; every value below goes in through env_set (mktemp: mode 600).
  cp "${ENV_EXAMPLE}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  for spec in ${SECRET_SPECS}; do
    name="${spec%%:*}" bytes="${spec##*:}"
    env_set "${name}" "$(random_hex "${bytes}")"
  done
  env_set DOMAIN "${DOMAIN}"
  env_set SITE_URL "${SITE_URL:-$(site_url_for "${DOMAIN}")}"
  env_set ADMIN_LOGIN "${ADMIN_LOGIN}"
  env_set ADMIN_PASSWORD "${ADMIN_PASSWORD}"
  env_set TELEGRAM_BOT_TOKEN "${TELEGRAM_BOT_TOKEN:-}"
  env_set TELEGRAM_OWNER_ID "${TELEGRAM_OWNER_ID:-}"
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_OWNER_ID:-}" ]; then
    env_set TELEGRAM_DRY_RUN 0
  else
    env_set TELEGRAM_DRY_RUN 1
    warn "Telegram is not configured: leads are stored and backups stay local (TELEGRAM_DRY_RUN=1). Later: set TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_ID, TELEGRAM_DRY_RUN=0 in .env and run the script again"
  fi
  [ -n "${BACKUP_SCHEDULE:-}" ] && env_set BACKUP_SCHEDULE "${BACKUP_SCHEDULE}"
  [ -n "${BACKUP_TIMEZONE:-}" ] && env_set BACKUP_TIMEZONE "${BACKUP_TIMEZONE}"
  env_set LETSENCRYPT_EMAIL "${LETSENCRYPT_EMAIL:-}"
  [ -n "${HTTP_PORT:-}" ] && env_set HTTP_PORT "${HTTP_PORT}"
  [ -n "${HTTPS_PORT:-}" ] && env_set HTTPS_PORT "${HTTPS_PORT}"
  return 0
}

data_exists() { [ -d "$1" ] && [ -n "$(ls -A "$1" 2>/dev/null)" ]; }

# Existing .env: empty secrets are generated — except the database / MinIO root passwords once their
# data exists (the running data keeps the old password; a new one would lock everything out).
fill_missing_secrets() {
  local spec name bytes volumes
  volumes="$(env_get VOLUMES_DIR)"
  for spec in ${SECRET_SPECS}; do
    name="${spec%%:*}" bytes="${spec##*:}"
    [ -n "$(env_get "${name}")" ] && continue
    if [ "${name}" = "POSTGRES_PASS" ] && data_exists "${volumes}/postgres"; then
      die "POSTGRES_PASS is empty in .env but ${volumes}/postgres already holds a database: put its password back"
    fi
    if [ "${name}" = "MINIO_ROOT_PASSWORD" ] && data_exists "${volumes}/minio"; then
      die "MINIO_ROOT_PASSWORD is empty in .env but ${volumes}/minio already holds data: put its password back"
    fi
    warn "${name} was empty: generated a new value"
    env_set "${name}" "$(random_hex "${bytes}")"
  done
}

# Creates or completes .env for the given proxy (caddy | nginx) and checks every value.
ensure_env() {
  local proxy="$1"
  [ -f "${ENV_FILE}" ] || create_env "${proxy}"
  chmod 600 "${ENV_FILE}"
  if [ -z "$(env_get VOLUMES_DIR)" ]; then
    env_set VOLUMES_DIR "${VOLUMES_DIR:-${TARGET_HOME}/docker-volumes/gadyuka}"
  fi
  fill_missing_secrets
  env_set COMPOSE_FILE "docker-compose.yml:docker-compose.${proxy}.yml"
  if [ "${proxy}" = "nginx" ]; then
    [ -n "${NGINX_TLS_MODE_WANTED:-}" ] && env_set NGINX_TLS_MODE "${NGINX_TLS_MODE_WANTED}"
    [ -n "${LETSENCRYPT_STAGING_WANTED:-}" ] && env_set LETSENCRYPT_STAGING "${LETSENCRYPT_STAGING_WANTED}"
    if [ "$(env_get NGINX_TLS_MODE)" != "self-signed" ] && [ -z "$(env_get LETSENCRYPT_EMAIL)" ]; then
      ask LETSENCRYPT_EMAIL "E-mail для Let's Encrypt (аккаунт сертификатов)"
      valid_email "${LETSENCRYPT_EMAIL:-}" || die "LETSENCRYPT_EMAIL is required for Let's Encrypt: set it in ${ENV_FILE} (or use --self-signed)"
      env_set LETSENCRYPT_EMAIL "${LETSENCRYPT_EMAIL}"
    fi
  fi
  if [ -n "${SUDO_USER:-}" ] && [ "${SKIP_HOST_SETUP}" != "1" ]; then
    chown "${SUDO_USER}" "${ENV_FILE}"
  fi
  validate_env "${proxy}"
}

check_min_length() {
  local value
  value="$(env_get "$1")"
  [ "${#value}" -ge "$2" ] || ENV_ERRORS="${ENV_ERRORS}\n  $1: at least $2 characters"
}

validate_env() {
  local proxy="$1" domain site_url volumes
  ENV_ERRORS=""
  domain="$(env_get DOMAIN)"
  site_url="$(env_get SITE_URL)"
  volumes="$(env_get VOLUMES_DIR)"
  valid_domain "${domain}" || ENV_ERRORS="${ENV_ERRORS}\n  DOMAIN: a domain name like gadyuka.ru (lowercase)"
  case "${site_url}" in
    "https://${domain}" | "https://${domain}:"[0-9]*) ;;
    *) ENV_ERRORS="${ENV_ERRORS}\n  SITE_URL: exactly https://${domain} (no trailing slash)" ;;
  esac
  case "${volumes}" in
    /*) ;;
    *) ENV_ERRORS="${ENV_ERRORS}\n  VOLUMES_DIR: an absolute path (e.g. /home/deploy/docker-volumes/gadyuka)" ;;
  esac
  valid_login "$(env_get ADMIN_LOGIN)" || ENV_ERRORS="${ENV_ERRORS}\n  ADMIN_LOGIN: 3–64 of a-z 0-9 . _ @ -"
  check_min_length ADMIN_PASSWORD 16
  # Docker Compose substitutes $… inside .env values and treats quotes / spaces specially.
  if compose_unsafe "$(env_get ADMIN_PASSWORD)"; then
    ENV_ERRORS="${ENV_ERRORS}\n  ADMIN_PASSWORD: no \$, quotes, backslash, backtick or spaces (Docker Compose would change it)"
  fi
  check_min_length INTERNAL_API_KEY 32
  check_min_length AUTH_ACCESS_SECRET 32
  check_min_length IP_HASH_SALT 16
  check_min_length POSTGRES_PASS 16
  check_min_length APP_DB_PASSWORD 16
  check_min_length MINIO_ROOT_PASSWORD 16
  check_min_length S3_SECRET_ACCESS_KEY 16
  if [ "$(env_get S3_ACCESS_KEY_ID)" = "$(env_get MINIO_ROOT_USER)" ]; then
    ENV_ERRORS="${ENV_ERRORS}\n  S3_ACCESS_KEY_ID: must differ from MINIO_ROOT_USER"
  fi
  if [ "$(env_get APP_DB_USER)" = "$(env_get POSTGRES_USER)" ]; then
    ENV_ERRORS="${ENV_ERRORS}\n  APP_DB_USER: must differ from POSTGRES_USER"
  fi
  if [ "$(env_get TELEGRAM_DRY_RUN)" = "0" ] && { [ -z "$(env_get TELEGRAM_BOT_TOKEN)" ] || [ -z "$(env_get TELEGRAM_OWNER_ID)" ]; }; then
    ENV_ERRORS="${ENV_ERRORS}\n  TELEGRAM_DRY_RUN=0 needs TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_ID (or set TELEGRAM_DRY_RUN=1)"
  fi
  # Both proxies pick files / names by it (Caddy: deploy/caddy/www-<value>.caddy).
  case "$(env_get WWW_REDIRECT)" in
    "" | 0 | 1) ;;
    *) ENV_ERRORS="${ENV_ERRORS}\n  WWW_REDIRECT: 0 or 1" ;;
  esac
  if [ "${proxy}" = "nginx" ]; then
    case "$(env_get LETSENCRYPT_STAGING)" in
      "" | 0 | 1) ;;
      *) ENV_ERRORS="${ENV_ERRORS}\n  LETSENCRYPT_STAGING: 0 or 1" ;;
    esac
    case "$(env_get NGINX_TLS_MODE)" in
      letsencrypt) valid_email "$(env_get LETSENCRYPT_EMAIL)" || ENV_ERRORS="${ENV_ERRORS}\n  LETSENCRYPT_EMAIL: an e-mail address" ;;
      self-signed) ;;
      *) ENV_ERRORS="${ENV_ERRORS}\n  NGINX_TLS_MODE: letsencrypt or self-signed" ;;
    esac
  fi
  if [ -n "${ENV_ERRORS}" ]; then
    printf '%sERROR:%s fix these values in %s:%b\n' "${C_ERR}" "${C_OFF}" "${ENV_FILE}" "${ENV_ERRORS}" >&2
    exit 1
  fi
  log ".env is complete (${ENV_FILE}, mode 600)"
}

# ── data folders ──────────────────────────────────────────────────────────────────────────────────

# <VOLUMES_DIR>/<service> for every image, owned by the uid that writes it inside the container.
ensure_volume_dirs() {
  local proxy="$1" volumes spec rel uid gid mode specs parent new_parent=0
  volumes="$(env_get VOLUMES_DIR)"
  specs="${VOLUME_SPECS}"
  if [ "${proxy}" = "caddy" ]; then specs="${specs} ${CADDY_VOLUME_SPECS}"; else specs="${specs} ${NGINX_VOLUME_SPECS}"; fi
  # ~/docker-volumes itself: when it is new and inside the user's home, it belongs to the user, not root.
  parent="$(dirname "${volumes}")"
  case "${parent}" in
    "${TARGET_HOME:-/nonexistent}"/*) [ -d "${parent}" ] || new_parent=1 ;;
  esac
  mkdir -p "${volumes}"
  if [ "${new_parent}" = "1" ] && [ "${SKIP_HOST_SETUP}" != "1" ] && [ -n "${SUDO_USER:-}" ]; then
    chown "${SUDO_USER}" "${parent}"
  fi
  for spec in ${specs}; do
    IFS=: read -r rel uid gid mode <<EOF
${spec}
EOF
    mkdir -p "${volumes}/${rel}"
  done
  if [ "${SKIP_HOST_SETUP}" != "1" ] && [ -n "${SUDO_USER:-}" ]; then
    chown "${SUDO_USER}" "${volumes}" "${volumes}/backend" "${volumes}/frontend"
  fi
  # Owners are set from INSIDE a container (and then checked the same way): the daemon maps the uids,
  # so this is right for rootful, rootless and userns-remapped Docker alike and needs no host root —
  # a host-side `chown 70` is wrong for rootless Docker, and skipped altogether by --skip-host-setup.
  for spec in ${specs}; do
    IFS=: read -r rel uid gid mode <<EOF
${spec}
EOF
    case "${rel}" in
      # Written only by the node user: fix whatever an earlier manual `docker compose up` created as root.
      backend/logs | frontend/*) set_volume_owner "${volumes}/${rel}" "${uid}:${gid}" "${mode}" -R ;;
      # The images fix their own data on start (postgres) or run as root.
      *) set_volume_owner "${volumes}/${rel}" "${uid}:${gid}" "${mode}" ;;
    esac
    check_volume_writable "${volumes}/${rel}" "${uid}:${gid}"
  done
  local names=""
  for spec in ${specs}; do names="${names:+${names},}${spec%%:*}"; done
  log "data folders: ${volumes}/{${names}} (owners set and write-checked from a container)"
}

# Any image of the stack with a shell and busybox chown: the helper containers below use it.
VOLUME_HELPER_IMAGE="postgres:18.1-alpine3.23"

# Runs `sh -c <script>` in a throw-away helper container with <dir> mounted at /v.
volume_helper() {
  local dir="$1" user="$2" script="$3"
  docker run --rm --network none --user "${user}" --entrypoint sh -v "${dir}:/v" "${VOLUME_HELPER_IMAGE}" -c "${script}"
}

# chown [-R] uid:gid + chmod of a data folder, done by the container's root.
set_volume_owner() {
  local dir="$1" owner="$2" mode="$3" recursive="${4:-}"
  volume_helper "${dir}" 0:0 "chown ${recursive} ${owner} /v && chmod ${mode} /v" >/dev/null 2>&1 ||
    volume_access_failure "${dir}" "root inside a container cannot change it"
}

# The uid the service runs as must be able to create a file in its folder.
check_volume_writable() {
  local dir="$1" owner="$2"
  volume_helper "${dir}" "${owner}" ': > /v/.gadyuka-write-test && rm -f /v/.gadyuka-write-test' >/dev/null 2>&1 ||
    volume_access_failure "${dir}" "uid ${owner%%:*} inside a container cannot write to it"
}

# Explains why a container cannot write to a host folder (the usual cause: not the standard Docker
# Engine) and stops before `up` (otherwise postgres would restart forever with "Permission denied").
volume_access_failure() {
  local dir="$1" reason="$2" security mode="the standard (rootful) Docker Engine"
  security="$(docker info --format '{{range .SecurityOptions}}{{.}} {{end}}' 2>/dev/null || true)"
  case "${security}" in
    *rootless*) mode="ROOTLESS Docker" ;;
    *userns*) mode="Docker with userns-remap" ;;
  esac
  if command -v snap >/dev/null 2>&1 && snap list docker >/dev/null 2>&1; then mode="Docker from SNAP"; fi
  print_generated_password
  cat >&2 <<EOF
${C_ERR}ERROR:${C_OFF} the data folder ${dir} is not usable: ${reason}.
  This host runs ${mode} (docker info: ${security:-n/a}).
  ls -ld: $(ls -ld "${dir}" 2>&1)
  How to fix:
  - Docker from snap is confined and cannot write to these folders: remove it and let the script install
    the official Docker Engine:  sudo snap remove docker && sudo ./deploy/up-${PROXY:-caddy}.sh
  - Rootless Docker: the folders must belong to the user that runs the rootless daemon:
      sudo chown -R "\$(id -u):\$(id -g)" "$(dirname "${dir}")" && ./deploy/up-${PROXY:-caddy}.sh
  - userns-remap: the folders must belong to the remapped root (first id in /etc/subuid for dockremap),
    or point VOLUMES_DIR in .env to a folder owned by it.
  - On a normal Linux server run the script with sudo and WITHOUT --skip-host-setup (that option is only
    for Docker Desktop on macOS / Windows).
  - Check the mount of that folder (read-only, NFS root_squash, noexec): findmnt -T "${dir}"
EOF
  exit 1
}

# Daily rotation of the backend's own log file (stdout logs are rotated by Docker: 5 × 10 MB).
install_logrotate() {
  [ "${SKIP_HOST_SETUP}" = "1" ] && return 0
  [ -d /etc/logrotate.d ] || return 0
  cat >/etc/logrotate.d/gadyuka <<EOF
# ГАДЮКА backend log (deploy/lib.sh). The app keeps the file open: copytruncate.
$(env_get VOLUMES_DIR)/backend/logs/*.log {
    su root root
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF
}

# ── compose ───────────────────────────────────────────────────────────────────────────────────────

compose() {
  docker compose --project-directory "${REPO_DIR}" --env-file "${ENV_FILE}" \
    -f "${REPO_DIR}/docker-compose.yml" -f "${REPO_DIR}/docker-compose.${PROXY}.yml" "$@"
}

# The proxy of an existing installation, from COMPOSE_FILE in .env.
detect_proxy() {
  case "$(env_get COMPOSE_FILE)" in
    *docker-compose.nginx.yml*) PROXY=nginx ;;
    *docker-compose.caddy.yml*) PROXY=caddy ;;
    *) die "no installation found (COMPOSE_FILE is not set in ${ENV_FILE}): run deploy/up-caddy.sh or deploy/up-nginx.sh first" ;;
  esac
}

# The admin password generated by this run (shown once: at the end, or before a failure message).
print_generated_password() {
  [ -n "${GENERATED_ADMIN_PASSWORD}" ] || return 0
  cat <<EOF
  Admin password (generated, shown ONCE — save it in a password manager; it is also in .env):
           ${GENERATED_ADMIN_PASSWORD}
EOF
  GENERATED_ADMIN_PASSWORD=""
}

show_failure() {
  warn "the stack did not come up healthy. Status and the last log lines:"
  compose ps -a >&2 || true
  compose logs --no-color --tail=40 >&2 || true
  print_generated_password
  die "see the messages above; after fixing, run the same script again (it is safe to repeat)"
}

check_dns() {
  local domain
  domain="$(env_get DOMAIN)"
  [ "${domain}" = "localhost" ] && return 0
  command -v getent >/dev/null 2>&1 || return 0
  if ! getent ahosts "${domain}" >/dev/null 2>&1; then
    warn "${domain} does not resolve yet: the certificate can only be issued once its A record points to this server"
  fi
}

# Builds the images one after another (less memory than in parallel), then starts everything and waits
# until every service is healthy (the one-off jobs must have finished successfully).
compose_up() {
  log "building the images (the first build takes 5–10 minutes)"
  if ! compose build migrate backend seed backup || ! compose build frontend; then
    print_generated_password
    die "the image build failed (messages above). Out of memory? Add swap (readme_dev.md). Then run the same script again"
  fi
  sync_db_owner_password
  log "starting: postgres → migrate → minio → minio-init → seed → backend → frontend → backup → ${PROXY}"
  compose up -d --remove-orphans --wait --wait-timeout "${WAIT_TIMEOUT:-600}" || show_failure
  docker image prune -f >/dev/null 2>&1 || true
}

# POSTGRES_PASSWORD only applies when postgres initialises an EMPTY data folder: an existing database keeps
# the password it was created with. A re-created .env (new generated POSTGRES_PASS) or an edited one would
# then lock migrate / seed / backend out ("password authentication failed"). So .env stays the source of
# truth: start postgres alone and set the owner's password over the container's local socket (trusted
# by the official image — no password needed there). psql variables keep any password safely quoted.
sync_db_owner_password() {
  compose up -d --wait --wait-timeout "${WAIT_TIMEOUT:-600}" postgres || show_failure
  if compose exec -T postgres sh -s >/dev/null 2>&1 <<'SH'
psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v owner="$POSTGRES_USER" -v pw="$POSTGRES_PASSWORD" <<'SQL'
ALTER ROLE :"owner" PASSWORD :'pw';
SQL
SH
  then
    log "database owner password matches .env"
    return 0
  fi
  print_generated_password
  die "cannot log in to the database in $(env_get VOLUMES_DIR)/postgres as $(env_get POSTGRES_USER) (database $(env_get POSTGRES_NAME)): it was created with other POSTGRES_USER / POSTGRES_NAME values (an earlier .env). Put those values back into ${ENV_FILE}, or — only for a test install without real data — remove that folder and run the script again"
}

print_summary() {
  local domain site_url
  domain="$(env_get DOMAIN)"
  site_url="$(env_get SITE_URL)"
  cat <<EOF

${C_INFO}ГАДЮКА is running${C_OFF} (proxy: ${PROXY})
  Site:    ${site_url}/   ${site_url}/en
  Admin:   ${site_url}/admin   (login: $(env_get ADMIN_LOGIN))
EOF
  print_generated_password
  cat <<EOF
  Data:    $(env_get VOLUMES_DIR)
  Config:  ${ENV_FILE}

  cd ${REPO_DIR}
  sudo docker compose ps                         # status / health
  sudo docker compose logs -f backend frontend   # app logs (Ctrl+C to leave)
  sudo docker compose logs -f ${PROXY}$([ "${PROXY}" = nginx ] && echo ' certbot')            # proxy / certificates
  sudo docker compose run --rm backup /opt/gadyuka-backup/backup-now.sh   # Telegram backup now
  sudo docker compose logs -f backup                  # backup schedule / delivery
  sudo ./deploy/backup.sh                        # local backup (14-day rotation)
EOF
}

# Common options of the up scripts; sets SKIP_HOST_SETUP and the nginx TLS wishes.
parse_common_option() {
  case "$1" in
    --skip-host-setup) SKIP_HOST_SETUP=1 ;;
    *) return 1 ;;
  esac
}
