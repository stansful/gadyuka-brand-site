import type { PrismaClient } from '../../src/generated/prisma/client';

import { isLocale, locales } from '../../src/i18n/locales';
import { MESSAGE_KEYS, defaultMessage, isMessageKey } from '../../src/i18n/messages';

/**
 * Site UI messages: messages/<locale>.json → `Message` rows, for every locale of
 * src/i18n/locales.ts.
 *
 * - missing row → created with the default (editedAt = null);
 * - row from the seed (editedAt IS NULL) whose value differs → updated: a new default in the
 *   JSON rolls out on the next seed;
 * - row edited in the admin (editedAt set) → left alone;
 * - SEED_OVERWRITE=1 → every row of a known key is reset to the default (editedAt = null);
 * - orphans (rows of keys no longer in the JSON, or of removed locales) are reported, never
 *   deleted — the site ignores them.
 */

type MessageSeedOptions = { overwrite: boolean };

type MessageUpdate = { key: string; locale: string; value: string };

/** How many orphan keys the log lists by name. */
const ORPHANS_LISTED = 10;

export async function seedMessages(prisma: PrismaClient, { overwrite }: MessageSeedOptions): Promise<void> {
  const rows = await prisma.message.findMany({ select: { key: true, locale: true, value: true, editedAt: true } });
  const byId = new Map(rows.map(row => [`${row.locale}\u0000${row.key}`, row]));

  const creates: MessageUpdate[] = [];
  const updates: MessageUpdate[] = [];
  let edited = 0;
  for (const locale of locales) {
    for (const key of MESSAGE_KEYS) {
      const value = defaultMessage(key, locale);
      const row = byId.get(`${locale}\u0000${key}`);
      if (!row) creates.push({ key, locale, value });
      else if (overwrite) {
        if (row.value !== value || row.editedAt !== null) updates.push({ key, locale, value });
      } else if (row.editedAt !== null) edited += 1;
      else if (row.value !== value) updates.push({ key, locale, value });
    }
  }

  if (creates.length > 0) await prisma.message.createMany({ data: creates, skipDuplicates: true });
  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map(({ key, locale, value }) =>
        // Without overwrite only seed-owned rows are touched: `editedAt: null` in the filter also
        // protects a row the admin saved after the read above.
        prisma.message.updateMany({
          where: overwrite ? { key, locale } : { key, locale, editedAt: null },
          data: { value, editedAt: null },
        }),
      ),
    );
  }

  const orphans = rows.filter(row => !isMessageKey(row.key) || !isLocale(row.locale));
  const orphanKeys = [...new Set(orphans.map(row => `${row.locale}:${row.key}`))];
  const total = MESSAGE_KEYS.length * locales.length;
  console.log(
    `  messages: ${MESSAGE_KEYS.length} keys × ${locales.length} locales = ${total} — ${creates.length} created, ` +
      `${updates.length} ${overwrite ? 'reset to the default' : 'updated to a new default'}, ` +
      `${edited} edited in the admin (kept)`,
  );
  if (orphanKeys.length > 0) {
    const listed = orphanKeys.slice(0, ORPHANS_LISTED).join(', ');
    const more = orphanKeys.length > ORPHANS_LISTED ? ` and ${orphanKeys.length - ORPHANS_LISTED} more` : '';
    console.log(
      `  messages: ${orphanKeys.length} orphan row(s) not in messages/*.json (kept, unused): ${listed}${more}`,
    );
  }
}
