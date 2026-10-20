import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { isImageKey } from '@/lib/content/registry';
import { db } from '@/lib/db';
import { parseLocalizedText, readText } from '@/lib/i18n-text';
import { processImage, removeStoredImage, sanitizeOriginalName, storeProcessedImage } from '@/lib/media';

import type { AdminMedia, AdminMediaRef, MediaPage, MediaUsage } from './types';

import { forgetAdminUserId, getAdminUserId } from './admin-user';
import { getAdminTranslations } from './i18n-server';
import { siteTextLabels } from './site-texts';

/** Media rows ↔ admin view models, uploads and usage checks (server-only, DB). */

export const adminMediaRefSelect = {
  id: true,
  url: true,
  width: true,
  height: true,
  alt: true,
} as const satisfies Prisma.MediaSelect;

type MediaRefRow = Prisma.MediaGetPayload<{ select: typeof adminMediaRefSelect }>;

export function toMediaRef(row: MediaRefRow): AdminMediaRef;
export function toMediaRef(row: MediaRefRow | null | undefined): AdminMediaRef | null;
export function toMediaRef(row: MediaRefRow | null | undefined): AdminMediaRef | null {
  if (!row) return null;
  return {
    id: row.id,
    // Media.url is the public link stored at upload time ("/media/<key>").
    url: row.url,
    width: row.width,
    height: row.height,
    alt: parseLocalizedText(row.alt),
  };
}

const usageCountSelect = {
  contentImages: true,
  collectionCovers: true,
  productImages: true,
  reviewAvatars: true,
  newsImages: true,
  galleryItems: true,
  offerImages: true,
  partnerLogos: true,
  ogImageSettings: true,
} as const satisfies Prisma.MediaCountOutputTypeSelect;

export const adminMediaSelect = {
  ...adminMediaRefSelect,
  mime: true,
  size: true,
  originalName: true,
  createdAt: true,
  _count: { select: usageCountSelect },
} as const satisfies Prisma.MediaSelect;

type AdminMediaRow = Prisma.MediaGetPayload<{ select: typeof adminMediaSelect }>;

export function toAdminMedia(row: AdminMediaRow): AdminMedia {
  const counts = row._count;
  const usageCount =
    counts.contentImages +
    counts.collectionCovers +
    counts.productImages +
    counts.reviewAvatars +
    counts.newsImages +
    counts.galleryItems +
    counts.offerImages +
    counts.partnerLogos +
    counts.ogImageSettings;
  return {
    ...toMediaRef(row),
    mime: row.mime,
    size: row.size,
    originalName: row.originalName,
    createdAt: row.createdAt.toISOString(),
    usageCount,
  };
}

export const MEDIA_PAGE_SIZE = 60;

/** Newest first, cursor = last id of the previous page. Search matches the original name. */
export async function listMedia(
  options: { cursor?: string | null; query?: string; take?: number } = {},
): Promise<MediaPage> {
  const take = Math.min(Math.max(options.take ?? MEDIA_PAGE_SIZE, 1), 200);
  const query = options.query?.trim().slice(0, 100);
  const rows = await db.media.findMany({
    where: query ? { originalName: { contains: query, mode: 'insensitive' } } : undefined,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    select: adminMediaSelect,
  });
  const hasMore = rows.length > take;
  const items = (hasMore ? rows.slice(0, take) : rows).map(toAdminMedia);
  return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
}

export async function getAdminMedia(id: string): Promise<AdminMedia | null> {
  const row = await db.media.findUnique({ where: { id }, select: adminMediaSelect });
  return row ? toAdminMedia(row) : null;
}

/**
 * Validate → convert → PutObject to S3 → create the Media row, owned by the ADMIN user
 * (src/lib/admin/admin-user.ts). The object is deleted again if the insert fails.
 */
export async function createMediaFromUpload(input: { data: Uint8Array; originalName: string }): Promise<AdminMedia> {
  const image = await processImage(input.data);
  const ownerId = await getAdminUserId();
  const stored = await storeProcessedImage(image, { ownerType: 'ADMIN', ownerId });
  try {
    const row = await db.media.create({
      data: {
        ownerType: 'ADMIN',
        ownerId,
        uuid: stored.uuid,
        bucket: stored.bucket,
        key: stored.key,
        url: stored.url,
        mime: image.mime,
        width: image.width,
        height: image.height,
        size: image.size,
        alt: {},
        originalName: sanitizeOriginalName(input.originalName),
      },
      select: adminMediaSelect,
    });
    return toAdminMedia(row);
  } catch (error: unknown) {
    await removeStoredImage(stored).catch((cleanupError: unknown) => {
      console.error(`[admin] orphaned media object ${stored.key} (insert failed, delete failed too):`, cleanupError);
    });
    // FK violation on ownerId: the cached ADMIN user no longer exists (database re-created).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') forgetAdminUserId();
    throw error;
  }
}

/**
 * Every place that references a media file, with links to the admin pages that use it
 * (kinds and fallback titles: admin.media.usages).
 */
export async function getMediaUsages(mediaId: string): Promise<MediaUsage[]> {
  const row = await db.media.findUnique({
    where: { id: mediaId },
    select: {
      contentImages: { select: { key: true } },
      collectionCovers: { select: { id: true, title: true } },
      productImages: { select: { product: { select: { id: true, title: true } } } },
      reviewAvatars: { select: { id: true, author: true } },
      newsImages: { select: { id: true, title: true } },
      galleryItems: { select: { id: true, caption: true } },
      offerImages: { select: { id: true, title: true } },
      partnerLogos: { select: { id: true, name: true } },
      ogImageSettings: { select: { id: true } },
    },
  });
  if (!row) return [];

  const [t, tTexts] = await Promise.all([
    getAdminTranslations('admin.media.usages'),
    getAdminTranslations('admin.siteTexts'),
  ]);
  const labels = siteTextLabels(tTexts);
  const usages: MediaUsage[] = [];
  for (const image of row.contentImages) {
    // "about.image" → the «about» section of the content page.
    const section = image.key.split('.')[0] ?? image.key;
    usages.push({
      kind: t('landingImage'),
      title: isImageKey(image.key)
        ? t('landingImageTitle', { section: labels.section(section), image: labels.image(image.key) })
        : image.key,
      href: `/admin/content?section=${encodeURIComponent(section)}`,
    });
  }
  for (const item of row.collectionCovers) {
    usages.push({
      kind: t('collectionCover'),
      title: readText(item.title, 'ru'),
      href: `/admin/collections/${item.id}`,
    });
  }
  for (const item of row.productImages) {
    usages.push({
      kind: t('productPhoto'),
      title: readText(item.product.title, 'ru'),
      href: `/admin/products/${item.product.id}`,
    });
  }
  for (const item of row.reviewAvatars) {
    usages.push({ kind: t('reviewAvatar'), title: item.author, href: `/admin/reviews/${item.id}` });
  }
  for (const item of row.newsImages) {
    usages.push({ kind: t('news'), title: readText(item.title, 'ru'), href: `/admin/news/${item.id}` });
  }
  for (const item of row.galleryItems) {
    usages.push({
      kind: t('gallery'),
      title: readText(item.caption, 'ru') || t('galleryPhoto'),
      href: `/admin/gallery/${item.id}`,
    });
  }
  for (const item of row.offerImages) {
    usages.push({ kind: t('offer'), title: readText(item.title, 'ru'), href: `/admin/offers/${item.id}` });
  }
  for (const item of row.partnerLogos) {
    usages.push({ kind: t('partnerLogo'), title: item.name, href: `/admin/partners/${item.id}` });
  }
  if (row.ogImageSettings.length > 0) {
    usages.push({ kind: t('settings'), title: t('ogImage'), href: '/admin/settings' });
  }
  return usages;
}
