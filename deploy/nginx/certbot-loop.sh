#!/bin/sh
# ГАДЮКА — the certificate keeper of the nginx variant (docker-compose.nginx.yml, certbot/certbot image).
#
#   NGINX_TLS_MODE=letsencrypt (default)
#     1. `certbot certonly --webroot` for DOMAIN (+ www.DOMAIN when WWW_REDIRECT=1) when there is no
#        certificate yet, its names differ, or it is a staging certificate while LETSENCRYPT_STAGING=0;
#        a failed request is retried every 15 minutes (check the DNS A record and port 80 meanwhile).
#     2. `certbot renew` every 12 hours (renews 30 days before expiry). nginx notices the new files and
#        reloads by itself (nginx-start.sh).
#   NGINX_TLS_MODE=self-signed
#     a self-signed certificate (1 year, renewed 30 days before expiry) in
#     /etc/letsencrypt/self-signed/<DOMAIN>/ — for local tests (`./deploy/up-nginx.sh --self-signed`).
set -eu

: "${DOMAIN:?DOMAIN is not set}"
MODE="${NGINX_TLS_MODE:-letsencrypt}"
WEBROOT=/var/www/certbot
RENEW_INTERVAL_SECONDS=43200
RETRY_SECONDS=900
CHECK_SECONDS=86400
RENEW_BEFORE_SECONDS=2592000

DOMAINS="${DOMAIN}"
if [ "${WWW_REDIRECT:-0}" = "1" ]; then
  DOMAINS="${DOMAIN} www.${DOMAIN}"
fi

log() {
  echo "[certbot] $*"
}

# Sleeps in the background so `docker compose stop` (SIGTERM) ends the loop at once.
nap() {
  sleep "$1" &
  wait $!
}
trap 'exit 0' TERM INT

# The DNS names of a certificate, sorted, one line.
names_of() {
  openssl x509 -in "$1" -noout -ext subjectAltName 2>/dev/null | grep -o 'DNS:[^,]*' | cut -d : -f 2 | sort | tr '\n' ' '
}

wanted_names() {
  # shellcheck disable=SC2086 # one name per word
  printf '%s\n' ${DOMAINS} | sort | tr '\n' ' '
}

is_staging() {
  openssl x509 -in "$1" -noout -issuer 2>/dev/null | grep -qi 'staging'
}

self_signed() {
  dir="/etc/letsencrypt/self-signed/${DOMAIN}"
  cert="${dir}/fullchain.pem"
  if [ -s "${cert}" ] && [ "$(names_of "${cert}")" = "$(wanted_names)" ] &&
    openssl x509 -in "${cert}" -noout -checkend "${RENEW_BEFORE_SECONDS}" >/dev/null; then
    return 0
  fi
  # shellcheck disable=SC2086 # one name per word
  san="$(printf 'DNS:%s,' ${DOMAINS})"
  tmp="$(mktemp -d)"
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 365 \
    -subj "/CN=${DOMAIN}" -addext "subjectAltName=${san%,}" \
    -keyout "${tmp}/privkey.pem" -out "${tmp}/fullchain.pem" 2>/dev/null
  mkdir -p "${dir}"
  chmod 700 "${dir}"
  chmod 600 "${tmp}/privkey.pem"
  chmod 644 "${tmp}/fullchain.pem"
  mv "${tmp}/privkey.pem" "${dir}/privkey.pem"
  mv "${tmp}/fullchain.pem" "${dir}/fullchain.pem"
  rmdir "${tmp}"
  log "self-signed certificate for: ${DOMAINS}"
}

# 0 when a (new) certificate must be requested; sets FORCE for a staging → production switch.
needs_certificate() {
  cert="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
  FORCE=""
  if [ ! -s "${cert}" ]; then
    return 0
  fi
  if [ "$(names_of "${cert}")" != "$(wanted_names)" ]; then
    return 0
  fi
  if [ "${LETSENCRYPT_STAGING:-0}" != "1" ] && is_staging "${cert}"; then
    FORCE="--force-renewal"
    return 0
  fi
  return 1
}

request_certificate() {
  if [ -z "${LETSENCRYPT_EMAIL:-}" ]; then
    log "LETSENCRYPT_EMAIL is not set (the e-mail of the Let's Encrypt account): set it in .env"
    return 1
  fi
  set -- certonly --webroot -w "${WEBROOT}" --cert-name "${DOMAIN}" --expand \
    --email "${LETSENCRYPT_EMAIL}" --agree-tos --no-eff-email --non-interactive --key-type ecdsa
  for name in ${DOMAINS}; do
    set -- "$@" -d "${name}"
  done
  if [ "${LETSENCRYPT_STAGING:-0}" = "1" ]; then
    set -- "$@" --staging
  fi
  if [ -n "${FORCE}" ]; then
    set -- "$@" "${FORCE}"
  fi
  log "requesting a certificate for: ${DOMAINS}$([ "${LETSENCRYPT_STAGING:-0}" = "1" ] && echo ' (staging)')"
  certbot "$@"
}

# nginx serves the challenge files over HTTP (bootstrap or full config) — wait until it answers.
wait_for_nginx() {
  tries=0
  until wget -q -O /dev/null http://nginx/.proxy-health 2>/dev/null; do
    tries=$((tries + 1))
    if [ "${tries}" -ge 60 ]; then
      log "nginx does not answer on http://nginx/ — requesting anyway"
      return 0
    fi
    nap 2
  done
}

lets_encrypt() {
  wait_for_nginx
  until ! needs_certificate || request_certificate; do
    log "certificate request failed. Check: the DNS A record of ${DOMAIN} points to this server, ports 80/443 are open. Next try in $((RETRY_SECONDS / 60)) min"
    nap "${RETRY_SECONDS}"
  done
  log "certificate for ${DOMAINS} is in place; renewal check every $((RENEW_INTERVAL_SECONDS / 3600)) h"
  while nap "${RENEW_INTERVAL_SECONDS}"; do
    certbot renew --quiet --no-random-sleep-on-renew || log "renewal failed (will retry in $((RENEW_INTERVAL_SECONDS / 3600)) h)"
  done
}

case "${MODE}" in
  self-signed)
    self_signed
    while nap "${CHECK_SECONDS}"; do
      self_signed
    done
    ;;
  letsencrypt)
    lets_encrypt
    ;;
  *)
    log "NGINX_TLS_MODE must be letsencrypt or self-signed, got: ${MODE}"
    exit 1
    ;;
esac
