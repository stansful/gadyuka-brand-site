import type { PrismaClient } from '../../src/generated/prisma/client';

import { IMAGE_KEYS, type ImageKey } from '../../src/lib/content/registry';
import { SEED_CONTENT_IMAGES, type SeedMediaKey } from '../seed-data/media';

/**
 * Landing images (`ContentImage`, key → Media): every key of CONTENT_IMAGES gets a row with its
 * seed image. Existing rows are left alone (the admin may have picked another photo or none);
 * SEED_OVERWRITE=1 points them back at the seed image.
 */

type ContentImageSeedOptions = { overwrite: boolean };

/** Image keys without a row (new keys after a code update) — their seed images are needed. */
export async function missingContentImageKeys(prisma: PrismaClient): Promise<ImageKey[]> {
  const rows = await prisma.contentImage.findMany({ select: { key: true } });
  const existing = new Set(rows.map(row => row.key));
  return IMAGE_KEYS.filter(key => !existing.has(key));
}

export async function seedContentImages(
  prisma: PrismaClient,
  media: Partial<Record<SeedMediaKey, string>>,
  { overwrite }: ContentImageSeedOptions,
): Promise<void> {
  let created = 0;
  for (const key of IMAGE_KEYS) {
    const mediaId = media[SEED_CONTENT_IMAGES[key]] ?? null;
    const existing = await prisma.contentImage.findUnique({ where: { key }, select: { key: true } });
    if (!existing) {
      await prisma.contentImage.create({ data: { key, mediaId } });
      created += 1;
    } else if (overwrite) {
      await prisma.contentImage.update({ where: { key }, data: { mediaId } });
    }
  }
  console.log(
    `  content images: ${IMAGE_KEYS.length} (${created} created${overwrite ? ', the rest reset to the seed image' : ''})`,
  );
}
