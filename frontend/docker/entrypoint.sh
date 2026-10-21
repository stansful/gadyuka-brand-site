#!/bin/sh
# ГАДЮКА frontend container start: publish the build's static files for the reverse proxy
# (publish-static.mjs → STATIC_PUBLISH_DIR), then run the standalone server (CMD: node server.js).
# A failed publish is logged and does not stop the site: the proxy forwards /_next/static/* and
# /brand/* to Next when a file is missing on its side.
set -eu

if [ -n "${STATIC_PUBLISH_DIR:-}" ]; then
  if ! node /usr/local/lib/gadyuka/publish-static.mjs; then
    echo "[gadyuka-frontend] WARNING: static files were not published to ${STATIC_PUBLISH_DIR} (is it writable by uid $(id -u)?); the proxy falls back to Next for them" >&2
  fi
fi

exec "$@"
