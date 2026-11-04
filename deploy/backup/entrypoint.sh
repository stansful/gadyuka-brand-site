#!/bin/sh
set -eu

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

export TZ="${BACKUP_TIMEZONE:-Europe/Moscow}"
BACKUP_SCHEDULE="${BACKUP_SCHEDULE:-30 3 * * *}"
mkdir -p /etc/crontabs
printf '%s /opt/gadyuka-backup/backup-now.sh >>/proc/1/fd/1 2>>/proc/1/fd/2\n' \
  "${BACKUP_SCHEDULE}" >/etc/crontabs/root
chmod 600 /etc/crontabs/root
printf '[backup] schedule: %s (%s)\n' "${BACKUP_SCHEDULE}" "${TZ}"
exec crond -f -l 2
