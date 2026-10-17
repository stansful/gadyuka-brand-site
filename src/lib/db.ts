import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * PrismaClient singleton (Prisma 7 + @prisma/adapter-pg driver adapter).
 *
 *   import { db } from "@/lib/db";
 *
 * Server-only. Scripts that run outside Next.js (prisma/seed.ts) create their own
 * client the same way, because "server-only" throws outside the react-server graph.
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and start the database (npm run db:up).");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as typeof globalThis & { __gadyukaPrisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.__gadyukaPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  // Survive HMR in dev without opening a new pool on every reload.
  globalForPrisma.__gadyukaPrisma = db;
}

export type { PrismaClient };
