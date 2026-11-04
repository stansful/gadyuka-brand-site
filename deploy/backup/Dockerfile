FROM pgsty/minio:RELEASE.2026-08-04T00-00-00Z AS minio

FROM postgres:18.1-alpine3.23

USER root
RUN apk add --no-cache coreutils curl jq tzdata util-linux
COPY --from=minio /usr/bin/mc /usr/local/bin/mc
COPY deploy/backup/backup-now.sh deploy/backup/entrypoint.sh /opt/gadyuka-backup/
RUN chmod 755 /opt/gadyuka-backup/backup-now.sh /opt/gadyuka-backup/entrypoint.sh

ENTRYPOINT ["/opt/gadyuka-backup/entrypoint.sh"]
