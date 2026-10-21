// The server's own database role (least privilege), applied by the one-off `migrate` service of the
// root docker-compose.yml right after `prisma migrate deploy` — on every deploy, so it also works for an
// existing database and picks up a changed APP_DB_PASSWORD (a postgres initdb script runs only once, on
// an empty data directory).
//
//   APP_DB_USER / APP_DB_PASSWORD   the role the backend connects with: LOGIN, no superuser / createdb /
//                                   createrole / replication / bypassrls; SELECT, INSERT, UPDATE, DELETE
//                                   on the tables of schema public and USAGE on its sequences — no DDL,
//                                   nothing on _prisma_migrations
//   POSTGRES_*                      the owner (the image's POSTGRES_USER), who runs the migrations and
//                                   therefore owns every table: ALTER DEFAULT PRIVILEGES makes tables of
//                                   later migrations readable / writable by the role at once
//
// Idempotent, one transaction. Values are quoted by pg (escapeIdentifier / escapeLiteral) and never logged.
import pg from 'pg';

const ROLE_NAME = /^[a-z_][a-z0-9_]{0,62}$/;
const MIN_PASSWORD_LENGTH = 16;
const MIGRATIONS_TABLE = '_prisma_migrations';

function required(name) {
  const value = process.env[name] ?? '';
  if (value === '') throw new Error(`${name} is not set`);
  return value;
}

function readSettings() {
  const appUser = required('APP_DB_USER');
  const appPassword = required('APP_DB_PASSWORD');
  const owner = required('POSTGRES_USER');
  if (!ROLE_NAME.test(appUser)) throw new Error('APP_DB_USER must match [a-z_][a-z0-9_]{0,62}');
  if (appUser === owner) throw new Error('APP_DB_USER must differ from POSTGRES_USER (the owner)');
  if (appPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`APP_DB_PASSWORD must have at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return { appUser, appPassword, owner };
}

function statements(client, { appUser, appPassword, owner }) {
  const role = client.escapeIdentifier(appUser);
  const ownerRole = client.escapeIdentifier(owner);
  const database = client.escapeIdentifier(required('POSTGRES_NAME'));
  return [
    `ALTER ROLE ${role} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${client.escapeLiteral(appPassword)}`,
    `GRANT CONNECT ON DATABASE ${database} TO ${role}`,
    `GRANT USAGE ON SCHEMA public TO ${role}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerRole} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerRole} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`,
  ];
}

async function ensureRole(client, settings) {
  const { rowCount } = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [settings.appUser]);
  if (rowCount === 0) await client.query(`CREATE ROLE ${client.escapeIdentifier(settings.appUser)} LOGIN`);
  for (const sql of statements(client, settings)) await client.query(sql);
  const migrations = await client.query('SELECT to_regclass($1) AS name', [`public.${MIGRATIONS_TABLE}`]);
  if (migrations.rows[0]?.name !== null) {
    await client.query(
      `REVOKE ALL ON TABLE public.${MIGRATIONS_TABLE} FROM ${client.escapeIdentifier(settings.appUser)}`,
    );
  }
}

async function main() {
  const settings = readSettings();
  const client = new pg.Client({
    host: required('POSTGRES_HOST'),
    port: Number(required('POSTGRES_PORT')),
    user: settings.owner,
    password: required('POSTGRES_PASS'),
    database: required('POSTGRES_NAME'),
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    await ensureRole(client, settings);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
  process.stdout.write(`[app-db-role] role "${settings.appUser}" is ready (DML only on schema public)\n`);
}

main().catch(error => {
  process.stderr.write(`[app-db-role] failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
