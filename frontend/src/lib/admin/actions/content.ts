'use server';

import type { Prisma } from '@/generated/prisma/client';
import { locales, type Locale } from '@/i18n/locales';
import { defaultMessageTranslations, isMessageKey, type MessageKey } from '@/i18n/messages';
import { revalidateContent } from '@/lib/content/cache';
import { isImageKey } from '@/lib/content/registry';
import { db } from '@/lib/db';

import { adminAction, findMissingMediaIds } from '../action-helpers';
import { actionFail, actionOk, type ActionResult, type FieldErrors } from '../action-result';
import { getAdminTranslations } from '../i18n-server';
import { siteTextsInputSchema, type SiteTextsInput } from '../schemas';
import {
  isSiteTextEdit,
  planSiteImageSave,
  planSiteTextSave,
  siteTextConflictFailure,
  type SiteImageChange,
  type SiteTextChange,
} from '../site-text-save';
import {
  resetSiteTextWrites,
  siteTextErrorMessage,
  siteTextLabels,
  siteTextValueError,
  type SiteTextWrite,
} from '../site-texts';
import { parseInput } from '../validation';

/**
 * «Тексты сайта» — Server Actions over `Message` (site UI copy) and `ContentImage` (landing
 * images). Semantics of Message.editedAt (see src/lib/admin/site-texts.ts): null = the default
 * of messages/<locale>.json, set = edited in the admin. Every write refreshes the public site
 * (revalidateContent → the "content" cache tag, which also covers next-intl's messages).
 */

/** First key of the two-key advisory lock that serializes the «Тексты сайта» writes ("text"). */
const SITE_TEXTS_LOCK_NAMESPACE = 0x7e47;

/**
 * Runs `work` in a transaction that first takes the «Тексты сайта» advisory lock: a save
 * reads the rows it checks for conflicts and writes them with no other save or reset in
 * between (each one sees what the previous one committed).
 */
function withSiteTextsLock<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(
    async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SITE_TEXTS_LOCK_NAMESPACE}::int4, 0)`;
      return work(tx);
    },
    // The timeout covers waiting for the lock and a large save (every row of a search).
    { maxWait: 5_000, timeout: 30_000 },
  );
}

function upsertMessage(tx: Prisma.TransactionClient, write: SiteTextWrite) {
  const where = { key_locale: { key: write.key, locale: write.locale } };
  const data = { value: write.value, editedAt: write.editedAt };
  return tx.message.upsert({
    where,
    create: { key: write.key, locale: write.locale, ...data },
    update: data,
    select: { key: true },
  });
}

/** What the editor shows after a save: the stored value of every submitted text and language. */
export type SavedSiteTexts = { saved: number; values: Partial<Record<MessageKey, Partial<Record<Locale, string>>>> };

/**
 * Saves the texts (and landing images) the editor changed. Checks, in order:
 * 1. shape (zod: known locales, length, no duplicate keys);
 * 2. every key is a current site message key, every image key a landing image;
 * 3. per edited value (siteTextValueError): required Russian texts, link format, ICU syntax
 *    and exactly the {arguments} / <tags> of the default;
 * 4. referenced media exist;
 * 5. inside the transaction, under the «Тексты сайта» lock: every edit still starts from what
 *    is stored (site-text-save.ts) — a text or image changed in another tab or session since
 *    the editor loaded it refuses the whole save, naming it, instead of overwriting it.
 * Then only the values that change are upserted (editedAt = now; a value equal to the default
 * gets editedAt = null), together with the ContentImage rows, in that transaction.
 * Field errors are keyed "<message key>.<locale>" / "<image key>".
 */
export async function saveSiteTexts(input: SiteTextsInput): Promise<ActionResult<SavedSiteTexts>> {
  return adminAction('saveSiteTexts', async () => {
    const parsed = await parseInput(siteTextsInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const [t, tErrors] = await Promise.all([
      getAdminTranslations('admin.siteTexts'),
      getAdminTranslations('admin.siteTexts.errors'),
    ]);

    const fieldErrors: FieldErrors = {};
    const changes: SiteTextChange[] = [];
    for (const entry of parsed.data.entries) {
      if (!isMessageKey(entry.key)) {
        fieldErrors[entry.key] = tErrors('unknownKey');
        continue;
      }
      const key = entry.key;
      for (const locale of locales) {
        const change = entry.values[locale];
        if (change === undefined) continue;
        // A resent stored text (a language without a row) is never written as sent: no check.
        if (isSiteTextEdit(change)) {
          const error = siteTextValueError(key, locale, change.value);
          if (error) fieldErrors[`${key}.${locale}`] = siteTextErrorMessage(error, tErrors);
        }
        changes.push({ key, locale, value: change.value, base: change.base });
      }
    }

    const images: SiteImageChange[] = [];
    for (const image of parsed.data.images) {
      if (isImageKey(image.key)) images.push({ key: image.key, mediaId: image.mediaId, base: image.base });
      else fieldErrors[image.key] = tErrors('unknownImage');
    }
    if (Object.keys(fieldErrors).length > 0) return actionFail(tErrors('fixErrors'), fieldErrors);

    const missingMedia = await findMissingMediaIds(images.map(image => image.mediaId));
    if (missingMedia.length > 0) {
      const message = (await getAdminTranslations('admin.errors'))('missingMedia');
      for (const image of images) {
        if (image.mediaId && missingMedia.includes(image.mediaId)) fieldErrors[image.key] = message;
      }
      return actionFail(message, fieldErrors);
    }

    if (changes.length === 0 && images.length === 0) return actionOk({ saved: 0, values: {} }, t('noChanges'));

    const outcome = await withSiteTextsLock(async tx => {
      const rows = await tx.message.findMany({
        where: { key: { in: [...new Set(changes.map(change => change.key))] }, locale: { in: [...locales] } },
        select: { key: true, locale: true, value: true, editedAt: true },
      });
      const imageRows = await tx.contentImage.findMany({
        where: { key: { in: images.map(image => image.key) } },
        select: { key: true, mediaId: true },
      });
      const texts = planSiteTextSave(changes, rows, new Date());
      const pictures = planSiteImageSave(images, imageRows);
      if (texts.conflicts.length > 0 || pictures.conflicts.length > 0) {
        return { ok: false as const, texts: texts.conflicts, images: pictures.conflicts };
      }
      for (const write of texts.writes) await upsertMessage(tx, write);
      for (const image of pictures.writes) {
        await tx.contentImage.upsert({
          where: { key: image.key },
          create: { key: image.key, mediaId: image.mediaId },
          update: { mediaId: image.mediaId },
          select: { key: true },
        });
      }
      return { ok: true as const, saved: texts.writes.length + pictures.writes.length, values: texts.stored };
    });

    if (!outcome.ok) {
      const conflict = siteTextConflictFailure(outcome.texts, outcome.images, siteTextLabels(t), tErrors);
      return actionFail(conflict.message, conflict.fieldErrors);
    }
    if (outcome.saved === 0) return actionOk({ saved: 0, values: outcome.values }, t('noChanges'));
    revalidateContent();
    return actionOk({ saved: outcome.saved, values: outcome.values }, t('saved'));
  });
}

/**
 * «Вернуть по умолчанию»: every locale of `key` gets its messages/<locale>.json value back,
 * with editedAt = null (the seed keeps such rows in sync with newer defaults).
 */
export async function resetSiteText(key: string): Promise<ActionResult<{ values: Record<Locale, string> }>> {
  return adminAction('resetSiteText', async () => {
    const t = await getAdminTranslations('admin.siteTexts');
    if (typeof key !== 'string' || !isMessageKey(key)) return actionFail(t('errors.unknownKey'));
    await withSiteTextsLock(async tx => {
      for (const write of resetSiteTextWrites(key)) await upsertMessage(tx, write);
    });
    revalidateContent();
    return actionOk({ values: defaultMessageTranslations(key) }, t('resetDone'));
  });
}
