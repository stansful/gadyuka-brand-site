import type { PrismaClient } from '@/generated/prisma/client';

import { SEED_ADMIN_USER_ID, seedAdminName } from '../seed-data/entities';

/**
 * The ADMIN user — the owner of admin uploads (S3 keys admin/<ownerId>/…). There is one for
 * now: the admin still signs in with ADMIN_PASSWORD. An existing ADMIN (the oldest one) is
 * reused; otherwise one is created with a fixed id, so the S3 keys of the seed media stay the
 * same after a database reset (objects already in the bucket are reused, not uploaded again).
 * Returns its id.
 */
export async function ensureAdminUser(prisma: PrismaClient): Promise<string> {
  const existing = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.user.create({
    data: { id: SEED_ADMIN_USER_ID, role: 'ADMIN', name: seedAdminName() },
    select: { id: true },
  });
  console.log(`  admin user: created «${seedAdminName()}» (${created.id})`);
  return created.id;
}
