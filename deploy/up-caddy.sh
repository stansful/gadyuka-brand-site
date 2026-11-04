#!/usr/bin/env bash
# ГАДЮКА — one command for the whole site with Caddy as the reverse proxy (automatic HTTPS):
#
#   sudo ./deploy/up-caddy.sh
#
# On Debian / Ubuntu: installs Docker Engine + the compose plugin (Docker's apt repository) if missing,
# creates .env on the first run (generated secrets; asks for the domain, the admin login / password and,
# optionally, the Telegram bot), creates the data folders under ~/docker-volumes/gadyuka with the right
# owners, builds the images and starts everything (migrations and the seed run before the backend), then
# waits until every service is healthy. Safe to run again: that is also the update command after
# `git pull` (readme_dev.md).
#
# Options:
#   --skip-host-setup   ONLY for a local test on Docker Desktop / OrbStack (macOS, Windows): no
#                       OS / root checks, no package installation, no ownership changes
#   -h, --help          this text
set -euo pipefail

# shellcheck source=deploy/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

PROXY=caddy

usage() { sed -n '2,/^set -euo/p' "$0" | sed '$d; s/^# \{0,1\}//'; }

for arg in "$@"; do
  case "${arg}" in
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
check_dns
ensure_volume_dirs "${PROXY}"
install_logrotate
compose_up
print_summary
