import { existsSync } from 'node:fs';

import { defineConfig } from 'prisma/config';

import { PostgresUrl } from './src/database/postgres-url';

/**
 * Prisma CLI configuration (migrate, generate, studio). No dotenv: variables already in the
 * environment win (npm scripts may preload .env + .env.test with `node --env-file`), the local
 * .env only fills in the rest. `prisma generate` needs no database, so the URL is optional here.
 */
const ENV_FILE = '.env';

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

export default defineConfig({
  schema: 'prisma/',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: PostgresUrl.hasEnvironment(process.env) ? PostgresUrl.fromEnvironment(process.env).toString() : undefined,
  },
});
