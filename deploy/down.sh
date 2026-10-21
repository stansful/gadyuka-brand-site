#!/usr/bin/env bash
# ГАДЮКА — stops and removes the containers of the stack (the proxy chosen by up-caddy.sh / up-nginx.sh,
# read from COMPOSE_FILE in .env). Data stays in the data folders (VOLUMES_DIR); start again with the
# same up script.
#
#   sudo ./deploy/down.sh
set -euo pipefail

# shellcheck source=deploy/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ "${1:-}" = "--skip-host-setup" ] && SKIP_HOST_SETUP=1
[ -f "${ENV_FILE}" ] || die "no ${ENV_FILE}: nothing was deployed from this folder"
docker info >/dev/null 2>&1 || die "cannot talk to Docker: run with sudo"
detect_proxy
compose down --remove-orphans
log "stopped; data kept in $(env_get VOLUMES_DIR)"
