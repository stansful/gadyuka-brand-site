import type { PrismaClient } from '../../src/generated/prisma/client';

import { parseLocalizedText } from '../../src/lib/i18n-text';
import { SEED_MEDIA_KEYS, seedMediaAlt, type SeedMediaKey } from '../seed-data/media';

/**
 * Alt texts of the seed images (messages/content/<locale>.json `mediaAlt`). seedMedia never
 * writes Media.alt; this sets it on rows whose alt is still empty, so an alt text edited in the
 * admin survives a re-seed. SEED_OVERWRITE=1 resets it.
 */

type MediaAltSeedOptions = { overwrite: boolean };

export async function seedMediaAltTexts(
  prisma: PrismaClient,
  media: Partial<Record<SeedMediaKey, string>>,
  { overwrite }: MediaAltSeedOptions,
): Promise<void> {
  const seeded = SEED_MEDIA_KEYS.flatMap(key => {
    const id = media[key];
    return id === undefined ? [] : [{ key, id }];
  });
  const rows = await prisma.media.findMany({
    where: { id: { in: seeded.map(item => item.id) } },
    select: { id: true, alt: true },
  });
  const altById = new Map(rows.map(row => [row.id, row.alt]));

  let updated = 0;
  for (const { key, id } of seeded) {
    if (!altById.has(id)) continue;
    const isEmpty = Object.keys(parseLocalizedText(altById.get(id))).length === 0;
    if (!overwrite && !isEmpty) continue;
    await prisma.media.update({ where: { id }, data: { alt: seedMediaAlt(key) } });
    updated += 1;
  }
  console.log(`  media alt texts: ${updated} of ${seeded.length} set${overwrite ? ' (reset)' : ' (only empty ones)'}`);
}
