import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { parseLocalizedText, readText } from "@/lib/i18n-text";
import { mediaPublicUrl } from "@/lib/media-url";
import { processImage, removeStoredFile, sanitizeOriginalName, storeProcessedImage } from "@/lib/media";
import { CONTENT_BLOCKS, CONTENT_SECTIONS, isContentKey } from "@/lib/content/registry";
import type { AdminMedia, AdminMediaRef, MediaPage, MediaUsage } from "./types";

/** Media rows ↔ admin view models, uploads and usage checks (server-only, DB). */

export const adminMediaRefSelect = {
  id: true,
  path: true,
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
    url: mediaPublicUrl(row.path),
    width: row.width,
    height: row.height,
    alt: parseLocalizedText(row.alt),
  };
}

const usageCountSelect = {
  contentBlocks: true,
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
    counts.contentBlocks +
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
export async function listMedia(options: { cursor?: string | null; query?: string; take?: number } = {}): Promise<MediaPage> {
  const take = Math.min(Math.max(options.take ?? MEDIA_PAGE_SIZE, 1), 200);
  const query = options.query?.trim().slice(0, 100);
  const rows = await db.media.findMany({
    where: query ? { originalName: { contains: query, mode: "insensitive" } } : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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

/** Validate → convert → store file → create the Media row (file is removed if the insert fails). */
export async function createMediaFromUpload(input: { data: Uint8Array; originalName: string }): Promise<AdminMedia> {
  const image = await processImage(input.data);
  const relativePath = await storeProcessedImage(image);
  try {
    const row = await db.media.create({
      data: {
        path: relativePath,
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
    await removeStoredFile(relativePath).catch(() => undefined);
    throw error;
  }
}

const sectionLabels: ReadonlyMap<string, string> = new Map(CONTENT_SECTIONS.map((section) => [section.id, section.label]));

/** Every place that references a media file, with links to the admin pages that use it. */
export async function getMediaUsages(mediaId: string): Promise<MediaUsage[]> {
  const row = await db.media.findUnique({
    where: { id: mediaId },
    select: {
      contentBlocks: { select: { key: true, section: true } },
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

  const usages: MediaUsage[] = [];
  for (const block of row.contentBlocks) {
    const label = isContentKey(block.key) ? CONTENT_BLOCKS[block.key].label : block.key;
    usages.push({
      kind: `Контент: ${sectionLabels.get(block.section) ?? block.section}`,
      title: label,
      href: `/admin/content?section=${encodeURIComponent(block.section)}`,
    });
  }
  for (const item of row.collectionCovers) {
    usages.push({ kind: "Обложка коллекции", title: readText(item.title, "ru"), href: `/admin/collections/${item.id}` });
  }
  for (const item of row.productImages) {
    usages.push({ kind: "Фото товара", title: readText(item.product.title, "ru"), href: `/admin/products/${item.product.id}` });
  }
  for (const item of row.reviewAvatars) {
    usages.push({ kind: "Аватар отзыва", title: item.author, href: `/admin/reviews/${item.id}` });
  }
  for (const item of row.newsImages) {
    usages.push({ kind: "Новость", title: readText(item.title, "ru"), href: `/admin/news/${item.id}` });
  }
  for (const item of row.galleryItems) {
    usages.push({ kind: "Галерея", title: readText(item.caption, "ru") || "Фото галереи", href: `/admin/gallery/${item.id}` });
  }
  for (const item of row.offerImages) {
    usages.push({ kind: "Спецпредложение", title: readText(item.title, "ru"), href: `/admin/offers/${item.id}` });
  }
  for (const item of row.partnerLogos) {
    usages.push({ kind: "Логотип партнёра", title: item.name, href: `/admin/partners/${item.id}` });
  }
  if (row.ogImageSettings.length > 0) {
    usages.push({ kind: "Настройки", title: "OG-картинка для соцсетей", href: "/admin/settings" });
  }
  return usages;
}
