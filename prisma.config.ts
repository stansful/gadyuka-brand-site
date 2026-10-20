import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 config. DATABASE_URL is read from .env (dotenv) or the environment.
// It is optional here so `prisma generate` works without a database (e.g. Docker build);
// migrate/seed/studio commands need it.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
