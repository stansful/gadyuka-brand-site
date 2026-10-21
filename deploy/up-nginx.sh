#!/usr/bin/env bash
# ГАДЮКА — one command for the whole site with nginx + certbot as the reverse proxy (Let's Encrypt):
#
#   sudo ./deploy/up-nginx.sh                 # trusted certificate from Let's Encrypt
#   sudo ./deploy/up-nginx.sh --staging       # Let's Encrypt staging (untrusted; for a first try)
#   ./deploy/up-nginx.sh --self-signed        # self-signed certificate (local tests, no public DNS)
#
# On Debian / Ubuntu: installs Docker Engine + the compose plugin (Docker's apt repository) if missing,
# creates .env on the first run (generated secrets; asks for the domain, the Let's Encrypt e-mail, the
# admin login / password and, optionally, the Telegram bot), creates the data folders under
# ~/docker-volumes/gadyuka with the right owners, builds the images and starts everything (migrations and
# the seed run before the backend; nginx serves the ACME challenge over HTTP until certbot has the
# certificate, then switches to HTTPS by itself), then waits until every service is healthy. Safe to run
# again: that is also the update command after `git pull` (README.md).
#
# Options (the certificate choice is stored in .env: NGINX_TLS_MODE, LETSENCRYPT_STAGING):
#   --letsencrypt       trusted Let's Encrypt certificate (the default; also switches back from the two below)
#   --staging           Let's Encrypt staging certificate
#   --self-signed       self-signed certificate
#   --skip-host-setup   local test on a machine that already runs Docker (e.g. Docker Desktop): no
#                       OS / root checks, no package installation, no ownership changes
#   -h, --help          this text
set -euo pipefail

# shellcheck source=deploy/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

PROXY=nginx
NGINX_TLS_MODE_WANTED=""
LETSENCRYPT_STAGING_WANTED=""

usage() { sed -n '2,/^set -euo/p' "$0" | sed '$d; s/^# \{0,1\}//'; }

for arg in "$@"; do
  case "${arg}" in
    --letsencrypt) NGINX_TLS_MODE_WANTED=letsencrypt LETSENCRYPT_STAGING_WANTED=0 ;;
    --staging) NGINX_TLS_MODE_WANTED=letsencrypt LETSENCRYPT_STAGING_WANTED=1 ;;
    --self-signed) NGINX_TLS_MODE_WANTED=self-signed ;;
    -h | --help) usage; exit 0 ;;
    *) parse_common_option "${arg}" || die "unknown option: ${arg} (see --help)" ;;
  esac
done

ensure_root "$@"
check_os
detect_target_user
ensure_packages
ensure_docker
check_memory
ensure_env "${PROXY}"
check_ports
[ "$(env_get NGINX_TLS_MODE)" = "letsencrypt" ] && check_dns
ensure_volume_dirs "${PROXY}"
install_logrotate
compose_up
print_summary
if [ "$(env_get NGINX_TLS_MODE)" = "letsencrypt" ] && [ "$(env_get LETSENCRYPT_STAGING)" = "1" ]; then
  warn "the certificate comes from Let's Encrypt STAGING (browsers do not trust it). For the real one: sudo ./deploy/up-nginx.sh --letsencrypt"
fi
