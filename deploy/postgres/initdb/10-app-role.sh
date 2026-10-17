#!/bin/sh
# ГАДЮКА — least-privilege database role for the running app (docker-compose.yml → db).
#
# The app connects as APP_DB_USER, which may only read and write rows in schema `public`
# (SELECT/INSERT/UPDATE/DELETE + sequences): no DDL, no COPY … PROGRAM, no other databases.
# Migrations and the seed keep using the bootstrap superuser (POSTGRES_USER) via `tools`.
#
# Runs automatically on the FIRST start of an empty data volume (docker-entrypoint-initdb.d).
# For an existing database — or after changing APP_DB_PASSWORD — run it by hand (idempotent):
#   docker compose exec db sh /docker-entrypoint-initdb.d/10-app-role.sh
set -e

APP_DB_USER="${APP_DB_USER:-gadyuka_app}"
if [ -z "${APP_DB_PASSWORD:-}" ]; then
  echo "[app-role] APP_DB_PASSWORD is not set — cannot create the app role" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_user="$APP_DB_USER" -v app_password="$APP_DB_PASSWORD" -v owner="$POSTGRES_USER" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN', :'app_user')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
              :'app_user', :'app_password') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_user') \gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_user') \gexec
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', :'app_user') \gexec
SELECT format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', :'app_user') \gexec
-- Tables created later by migrations (run as the owner) get the same grants automatically.
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
              :'owner', :'app_user') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I',
              :'owner', :'app_user') \gexec
SQL

echo "[app-role] role \"$APP_DB_USER\" is ready (DML only on schema public)"
