#!/bin/sh
# ГАДЮКА — start of the nginx container (docker-compose.nginx.yml). Renders the config into
# /etc/nginx/conf.d and keeps it in step with the TLS certificate:
#   no certificate yet  → templates/bootstrap.conf.template: HTTP only — the ACME challenge for certbot
#                          and /.proxy-health; everything else answers 503 until the certificate exists
#   certificate present → templates/site.conf.template (+ www.conf.template when WWW_REDIRECT=1)
# Every 10 s it fingerprints the certificate files; when they appear or change (first issuance, renewal,
# a new self-signed certificate) it renders again, checks with `nginx -t` and reloads. The active mode
# (bootstrap | https) is written to /tmp/gadyuka-nginx-mode: the healthcheck reports healthy only in
# https mode, so `docker compose up --wait` returns once the site is really served over HTTPS.
#
#   NGINX_TLS_MODE=letsencrypt  (default) /etc/letsencrypt/live/<DOMAIN>/{fullchain,privkey}.pem
#   NGINX_TLS_MODE=self-signed  /etc/letsencrypt/self-signed/<DOMAIN>/…  (local tests, certbot-loop.sh)
set -eu

: "${DOMAIN:?DOMAIN is not set}"
MODE="${NGINX_TLS_MODE:-letsencrypt}"
case "$MODE" in
  letsencrypt) CERT_DIR="/etc/letsencrypt/live/${DOMAIN}" ;;
  self-signed) CERT_DIR="/etc/letsencrypt/self-signed/${DOMAIN}" ;;
  *)
    echo "[nginx] NGINX_TLS_MODE must be letsencrypt or self-signed, got: ${MODE}" >&2
    exit 1
    ;;
esac
export DOMAIN CERT_DIR

SRC=/etc/gadyuka-nginx
CONF=/etc/nginx/conf.d
MODE_FILE=/tmp/gadyuka-nginx-mode
CHECK_SECONDS=10
# Only these variables are substituted: nginx's own $host, $request_uri … stay as they are.
# shellcheck disable=SC2016 # a literal list for envsubst
VARS='${DOMAIN} ${CERT_DIR}'

has_cert() {
  [ -s "${CERT_DIR}/fullchain.pem" ] && [ -s "${CERT_DIR}/privkey.pem" ]
}

fingerprint() {
  cat "${CERT_DIR}/fullchain.pem" "${CERT_DIR}/privkey.pem" 2>/dev/null | md5sum | cut -d ' ' -f 1
}

render() {
  rm -f "${CONF}"/*.conf
  cp "${SRC}/conf/http.conf" "${CONF}/00-http.conf"
  if has_cert; then
    envsubst "${VARS}" <"${SRC}/templates/site.conf.template" >"${CONF}/10-site.conf"
    if [ "${WWW_REDIRECT:-0}" = "1" ]; then
      envsubst "${VARS}" <"${SRC}/templates/www.conf.template" >"${CONF}/20-www.conf"
    fi
    RENDERED=https
    echo "[nginx] HTTPS config for ${DOMAIN} (${MODE}, ${CERT_DIR})"
  else
    envsubst "${VARS}" <"${SRC}/templates/bootstrap.conf.template" >"${CONF}/10-bootstrap.conf"
    RENDERED=bootstrap
    echo "[nginx] no certificate in ${CERT_DIR} yet: HTTP-only bootstrap config (ACME challenge), waiting for certbot"
  fi
}

watch_certificate() {
  applied="$(fingerprint)"
  while sleep "${CHECK_SECONDS}"; do
    current="$(fingerprint)"
    [ "${current}" = "${applied}" ] && continue
    render
    if nginx -t -q; then
      nginx -s reload
      applied="${current}"
      echo "${RENDERED}" >"${MODE_FILE}"
      echo "[nginx] certificate changed: config rendered again (${RENDERED}), nginx reloaded"
    else
      # e.g. a key written before its certificate: try again on the next round
      echo "[nginx] config check failed after a certificate change; retrying in ${CHECK_SECONDS} s" >&2
    fi
  done
}

render
nginx -t -q
echo "${RENDERED}" >"${MODE_FILE}"
watch_certificate &
exec nginx -g 'daemon off;'
