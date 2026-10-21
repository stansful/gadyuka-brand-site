#!/bin/sh
# Healthcheck of the certbot service: healthy once the certificate nginx uses exists.
set -eu
case "${NGINX_TLS_MODE:-letsencrypt}" in
  self-signed) test -s "/etc/letsencrypt/self-signed/${DOMAIN}/fullchain.pem" ;;
  *) test -s "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ;;
esac
