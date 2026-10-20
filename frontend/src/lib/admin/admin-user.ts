import 'server-only';
import { db } from '@/lib/db';

import { getAdminTranslations } from './i18n-server';

/**
 * The ADMIN User row that owns admin uploads (Media.ownerId, the "admin/<ownerId>/…" S3 prefix).
 *
 * The admin still signs in with ADMIN_PASSWORD (no per-person accounts yet), so every admin
 * upload belongs to the single ADMIN user the seed creates. If it is missing (a database that
 * was never seeded) it is created here. The id is cached per process; call forgetAdminUserId()
 * when it turned out to be stale (e.g. the database was re-created under a running app).
 */

let adminUserId: Promise<string> | null = null;

async function findOrCreateAdminUser(): Promise<string> {
  const existing = await db.user.findFirst({
    where: { role: 'ADMIN' },
    // The oldest ADMIN — the seeded one — even if more appear later.
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (existing) return existing.id;
  // Display name: admin.common.adminUserName (the seed uses the same name from messages/content).
  const name = (await getAdminTranslations('admin.common'))('adminUserName');
  const created = await db.user.create({ data: { role: 'ADMIN', name }, select: { id: true } });
  console.info(`[admin] no ADMIN user found — created one (${created.id}) to own admin uploads`);
  return created.id;
}

/** Id of the ADMIN user (looked up once per process; parallel callers share one lookup). */
export function getAdminUserId(): Promise<string> {
  if (!adminUserId) {
    adminUserId = findOrCreateAdminUser().catch((error: unknown) => {
      adminUserId = null;
      throw error;
    });
  }
  return adminUserId;
}

/** Drops the cached id: the next getAdminUserId() looks the user up again. */
export function forgetAdminUserId(): void {
  adminUserId = null;
}
