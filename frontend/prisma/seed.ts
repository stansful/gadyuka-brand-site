/**
 * Seed: `npm run db:seed` (prisma db seed → tsx prisma/seed.ts). The steps live in prisma/seed/*,
 * the data in prisma/seed-data/* and messages/**.json; this file only orders them.
 *
 * Every run:
 *   1. the ADMIN user (owner of the seed media) — reused when one exists;
 *   2. site UI messages (messages/<locale>.json → Message rows): missing rows are created, rows
 *      still holding a seed value (editedAt IS NULL) follow a changed default, rows edited in
 *      the admin are kept, orphans are reported;
 *   3. seed media (assets/* → WebP → S3) — all images on a first run, afterwards only those of
 *      newly added ContentImage keys; then their alt texts (only where still empty);
 *   4. ContentImage rows for missing image keys.
 * First run only (no SiteSettings row yet): the demo entities from BRIEF.md — collection
 * «Меня запомнят» with products, reviews, news, gallery, offers, partners, menu, social links and
 * settings (settings last: its row marks the database as seeded). On a seeded database they
 * are never touched again, so everything edited in the admin survives a re-seed.
 *
 * SEED_OVERWRITE=1: resets every seeded row to the seed copy — messages (editedAt cleared),
 * media (re-pointed at the current encodes) and alt texts, image keys, and every entity
 * (re-creating deleted demo rows, product photos as in the seed): an explicit «reset to demo
 * content». Nothing is ever deleted except product photos under overwrite.
 *
 * Runs outside Next.js, so it builds its own PrismaClient (src/lib/db.ts is server-only).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';
import { SEED_CONTENT_IMAGES, SEED_MEDIA, SEED_MEDIA_KEYS, isSeedMediaKey, type SeedMediaKey } from './seed-data/media';
import { ensureAdminUser } from './seed/admin-user';
import { missingContentImageKeys, seedContentImages } from './seed/content-images';
import { isSeeded, seedEntities } from './seed/entities';
import { seedMedia } from './seed/media';
import { seedMediaAltTexts } from './seed/media-alt';
import { seedMessages } from './seed/messages';

const overwrite = process.env.SEED_OVERWRITE === '1';

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set (see .env.example)');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const prisma = createClient();

/** seedMedia's { seedKey: mediaId } narrowed to the seed media keys. */
function toSeedMediaIds(ids: Readonly<Record<string, string>>): Partial<Record<SeedMediaKey, string>> {
  const out: Partial<Record<SeedMediaKey, string>> = {};
  for (const [key, id] of Object.entries(ids)) if (isSeedMediaKey(key)) out[key] = id;
  return out;
}

function requireAllMedia(media: Partial<Record<SeedMediaKey, string>>): Record<SeedMediaKey, string> {
  const out: Partial<Record<SeedMediaKey, string>> = {};
  const missing: SeedMediaKey[] = [];
  for (const key of SEED_MEDIA_KEYS) {
    const id = media[key];
    if (id === undefined) missing.push(key);
    else out[key] = id;
  }
  if (missing.length > 0) throw new Error(`Seed media not created: ${missing.join(', ')}`);
  // Every key was assigned above (or we threw).
  return out as Record<SeedMediaKey, string>;
}

async function main(): Promise<void> {
  console.log(`Seeding${overwrite ? ' (SEED_OVERWRITE=1: resetting seeded rows)' : ''}…`);
  const seedAllEntities = overwrite || !(await isSeeded(prisma));

  const ownerId = await ensureAdminUser(prisma);
  await seedMessages(prisma, { overwrite });

  // Media to create: everything on a first run / overwrite; afterwards only images of new image keys.
  const neededMedia: ReadonlySet<SeedMediaKey> = seedAllEntities
    ? new Set(SEED_MEDIA_KEYS)
    : new Set((await missingContentImageKeys(prisma)).map(key => SEED_CONTENT_IMAGES[key]));
  const media =
    neededMedia.size > 0
      ? toSeedMediaIds(
          await seedMedia(
            prisma,
            [...neededMedia].map(seedKey => ({ seedKey, sourcePath: SEED_MEDIA[seedKey].source })),
            { ownerId, overwrite },
          ),
        )
      : {};
  await seedMediaAltTexts(prisma, media, { overwrite });
  await seedContentImages(prisma, media, { overwrite });

  if (!seedAllEntities) {
    console.log(
      '  entities: database already seeded — collections, products, reviews, news, gallery, offers, partners, menu, social links and settings are left as edited in the admin (SEED_OVERWRITE=1 resets them)',
    );
    console.log('Seed complete.');
    return;
  }

  await seedEntities(prisma, requireAllMedia(media), { overwrite });
  console.log('Seed complete.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
