/**
 * Seed: `npm run db:seed` (prisma db seed → tsx prisma/seed.ts).
 *
 * - First run (no SiteSettings row yet): creates everything from BRIEF.md — media, content
 *   blocks, the collection «Меня запомнят» with products, reviews, news, gallery, offers,
 *   partners and settings (settings last: its row marks the database as seeded).
 * - Re-run on a seeded database: ONLY adds missing ContentBlocks (new registry keys, with
 *   their seed image) and syncs block structure (section, kind, order). Entities are never
 *   touched again, so deletions, renamed slugs, re-ordered or removed product photos and
 *   unpublished items from the admin survive a re-seed.
 * - SEED_OVERWRITE=1: resets every seeded row to the seed copy (re-creating deleted demo rows,
 *   product photos as in the seed) — an explicit "reset to demo content".
 * - Media: assets/* → sharp → WebP (≤2400 px) → UPLOAD_DIR/seed/<name>-<hash>.webp. The hash
 *   covers the source file and the encoding settings, so a changed image always gets a NEW
 *   URL (/uploads is served as immutable for a year — a file is never rewritten in place).
 *
 * Runs outside Next.js, so it builds its own PrismaClient (src/lib/db.ts is server-only).
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import sharp from "sharp";
import { PrismaClient } from "../src/generated/prisma/client";
import { CONTENT_BLOCKS, CONTENT_KEYS, contentKeyOrder, isImageKey } from "../src/lib/content/registry";
import { CONTENT_COPY, CONTENT_IMAGES } from "./seed-data/content";
import {
  SEED_COLLECTION,
  SEED_GALLERY,
  SEED_NEWS,
  SEED_OFFERS,
  SEED_PARTNERS,
  SEED_PRODUCTS,
  SEED_REVIEWS,
  SEED_SETTINGS,
} from "./seed-data/entities";
import { SEED_MEDIA, SEED_MEDIA_DIR, type SeedMediaKey } from "./seed-data/media";

const MAX_DIMENSION = 2400;
const WEBP_QUALITY = 84;

const overwrite = process.env.SEED_OVERWRITE === "1";
const projectRoot = process.cwd();
const uploadDir = path.resolve(projectRoot, process.env.UPLOAD_DIR ?? "./uploads");

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set (see .env.example)");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const prisma = createClient();

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

type ProcessedImage = { width: number; height: number; size: number };

/** Encoding settings are part of the file name hash: changing them yields new URLs. */
const ENCODING_SIGNATURE = `webp:q${WEBP_QUALITY}:max${MAX_DIMENSION}:e5:v1`;

/** Writes `target` from `source` unless it already exists (same name ⇒ same content). */
async function processImage(source: string, target: string): Promise<ProcessedImage> {
  if (await fileExists(target)) {
    const [meta, info] = await Promise.all([sharp(target).metadata(), stat(target)]);
    if (meta.width && meta.height) return { width: meta.width, height: meta.height, size: info.size };
  }
  const result = await sharp(source)
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 5 })
    .toFile(target);
  return { width: result.width, height: result.height, size: result.size };
}

/** "hoodie-white-logo.webp" + source bytes → "seed/hoodie-white-logo-1a2b3c4d.webp". */
async function hashedSeedPath(sourcePath: string, output: string): Promise<string> {
  const base = output.replace(/\.webp$/, "");
  const hash = createHash("sha256")
    .update(ENCODING_SIGNATURE)
    .update(await readFile(sourcePath))
    .digest("hex")
    .slice(0, 8);
  return `${SEED_MEDIA_DIR}/${base}-${hash}.webp`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches this seed image's rows: legacy "seed/<base>.webp" or hashed "seed/<base>-<8 hex>.webp". */
function seedPathPattern(output: string): RegExp {
  const base = escapeRegExp(output.replace(/\.webp$/, ""));
  return new RegExp(`^${escapeRegExp(SEED_MEDIA_DIR)}/${base}(?:-[0-9a-f]{8})?\\.webp$`);
}

/**
 * Seed media rows. Existing rows are reused (admin alt texts kept). Missing rows are created
 * only for the keys in `create` (first run: all; re-run: images of newly added content blocks)
 * — a seed image deleted in the admin is not resurrected. With SEED_OVERWRITE=1 the row is
 * pointed at the (possibly new, hashed) file and its alt text is reset.
 */
async function seedMedia(create: ReadonlySet<SeedMediaKey>): Promise<Partial<Record<SeedMediaKey, string>>> {
  const targetDir = path.join(uploadDir, SEED_MEDIA_DIR);
  await mkdir(targetDir, { recursive: true });
  const existingRows = await prisma.media.findMany({
    where: { path: { startsWith: `${SEED_MEDIA_DIR}/` } },
    select: { id: true, path: true },
  });

  const ids: Partial<Record<SeedMediaKey, string>> = {};
  let created = 0;
  let replaced = 0;
  for (const [key, media] of Object.entries(SEED_MEDIA) as Array<[SeedMediaKey, (typeof SEED_MEDIA)[SeedMediaKey]]>) {
    const pattern = seedPathPattern(media.output);
    const existing = existingRows.find((row) => pattern.test(row.path));

    if (existing && !overwrite) {
      // Keep the row as is; only restore a missing file under its current name.
      const absolute = path.join(uploadDir, existing.path);
      if (!(await fileExists(absolute))) await processImage(path.join(projectRoot, media.source), absolute);
      ids[key] = existing.id;
      continue;
    }
    if (!existing && !overwrite && !create.has(key)) continue;

    const source = path.join(projectRoot, media.source);
    const relativePath = await hashedSeedPath(source, media.output);
    const image = await processImage(source, path.join(uploadDir, relativePath));
    const fileFields = { path: relativePath, mime: "image/webp", width: image.width, height: image.height, size: image.size };

    if (existing) {
      await prisma.media.update({ where: { id: existing.id }, data: { ...fileFields, alt: media.alt } });
      if (existing.path !== relativePath) {
        // The row now points at the new URL; the old file is no longer referenced.
        await unlink(path.join(uploadDir, existing.path)).catch(() => undefined);
        replaced += 1;
      }
      ids[key] = existing.id;
    } else {
      const row = await prisma.media.create({
        data: { ...fileFields, alt: media.alt, originalName: path.basename(media.source) },
        select: { id: true },
      });
      ids[key] = row.id;
      created += 1;
    }
  }

  console.log(
    `  media: ${Object.keys(ids).length} seed images (${created} new${overwrite ? `, ${replaced} moved to a new URL` : ""}) in ${path.relative(projectRoot, targetDir)}/`,
  );
  return ids;
}

function requireAllMedia(media: Partial<Record<SeedMediaKey, string>>): Record<SeedMediaKey, string> {
  const missing = (Object.keys(SEED_MEDIA) as SeedMediaKey[]).filter((key) => media[key] === undefined);
  if (missing.length > 0) throw new Error(`Seed media not created: ${missing.join(", ")}`);
  return media as Record<SeedMediaKey, string>;
}

/** Content block keys that do not exist yet (new registry keys after a code update). */
async function missingContentKeys(): Promise<Set<string>> {
  const rows = await prisma.contentBlock.findMany({ select: { key: true } });
  const existing = new Set(rows.map((row) => row.key));
  return new Set(CONTENT_KEYS.filter((key) => !existing.has(key)));
}

/** Creates missing blocks; existing ones only get their structure synced (or reset with overwrite). */
async function seedContentBlocks(media: Partial<Record<SeedMediaKey, string>>): Promise<void> {
  for (const key of CONTENT_KEYS) {
    const definition = CONTENT_BLOCKS[key];
    const structure = { section: definition.section, kind: definition.kind, order: contentKeyOrder(key) };
    if (isImageKey(key)) {
      const mediaId = media[CONTENT_IMAGES[key]] ?? null;
      await prisma.contentBlock.upsert({
        where: { key },
        create: { key, ...structure, mediaId },
        update: overwrite ? { ...structure, mediaId } : structure,
      });
    } else {
      const copy = CONTENT_COPY[key];
      const value = { ru: copy.ru, en: copy.en };
      await prisma.contentBlock.upsert({
        where: { key },
        create: { key, ...structure, value },
        update: overwrite ? { ...structure, value } : structure,
      });
    }
  }
  console.log(`  content blocks: ${CONTENT_KEYS.length}`);
}

async function seedCatalog(media: Record<SeedMediaKey, string>): Promise<void> {
  const collectionData = {
    title: SEED_COLLECTION.title,
    description: SEED_COLLECTION.description,
    coverId: media[SEED_COLLECTION.cover],
    order: SEED_COLLECTION.order,
    published: true,
  };
  const collection = await prisma.collection.upsert({
    where: { slug: SEED_COLLECTION.slug },
    create: { slug: SEED_COLLECTION.slug, ...collectionData },
    update: overwrite ? collectionData : {},
    select: { id: true },
  });

  for (const [index, product] of SEED_PRODUCTS.entries()) {
    const productData = {
      collectionId: collection.id,
      title: product.title,
      description: product.description,
      details: product.details,
      price: null,
      order: index,
      published: true,
    };
    const images = product.images.map((mediaKey, imageIndex) => ({ mediaId: media[mediaKey], order: imageIndex }));
    const existing = await prisma.product.findUnique({ where: { slug: product.slug }, select: { id: true } });
    if (!existing) {
      // Photos are attached only together with a newly created product.
      await prisma.product.create({ data: { slug: product.slug, ...productData, images: { create: images } } });
    } else if (overwrite) {
      // Explicit reset: the product and its photo set become exactly the seed again.
      await prisma.$transaction([
        prisma.product.update({ where: { id: existing.id }, data: productData }),
        prisma.productImage.deleteMany({ where: { productId: existing.id } }),
        prisma.productImage.createMany({ data: images.map((image) => ({ productId: existing.id, ...image })) }),
      ]);
    }
    // else: the product exists and was possibly edited in the admin — leave it (and its photos) alone.
  }
  console.log(`  collection «${SEED_COLLECTION.title.ru}» with ${SEED_PRODUCTS.length} products`);
}

async function seedReviews(): Promise<void> {
  for (const [index, review] of SEED_REVIEWS.entries()) {
    const data = {
      author: review.author,
      role: review.role,
      text: review.text,
      rating: review.rating,
      order: index,
      published: true,
    };
    await prisma.review.upsert({
      where: { id: review.id },
      create: { id: review.id, ...data },
      update: overwrite ? data : {},
    });
  }
  console.log(`  reviews: ${SEED_REVIEWS.length}`);
}

async function seedNews(media: Record<SeedMediaKey, string>): Promise<void> {
  for (const item of SEED_NEWS) {
    const data = {
      title: item.title,
      excerpt: item.excerpt,
      body: item.body,
      date: new Date(item.date),
      imageId: media[item.image],
      published: true,
    };
    await prisma.newsItem.upsert({
      where: { slug: item.slug },
      create: { slug: item.slug, ...data },
      update: overwrite ? data : {},
    });
  }
  console.log(`  news: ${SEED_NEWS.length}`);
}

async function seedGallery(media: Record<SeedMediaKey, string>): Promise<void> {
  for (const [index, item] of SEED_GALLERY.entries()) {
    const data = { mediaId: media[item.media], caption: item.caption, order: index, published: true };
    await prisma.galleryItem.upsert({
      where: { id: item.id },
      create: { id: item.id, ...data },
      update: overwrite ? data : {},
    });
  }
  console.log(`  gallery: ${SEED_GALLERY.length}`);
}

async function seedOffers(media: Record<SeedMediaKey, string>): Promise<void> {
  for (const [index, offer] of SEED_OFFERS.entries()) {
    const data = {
      title: offer.title,
      text: offer.text,
      badge: offer.badge,
      ctaLabel: offer.ctaLabel,
      ctaHref: offer.ctaHref,
      validUntil: offer.validUntil ? new Date(offer.validUntil) : null,
      imageId: offer.image ? media[offer.image] : null,
      order: index,
      published: true,
    };
    await prisma.offer.upsert({
      where: { id: offer.id },
      create: { id: offer.id, ...data },
      update: overwrite ? data : {},
    });
  }
  console.log(`  offers: ${SEED_OFFERS.length}`);
}

async function seedPartners(): Promise<void> {
  for (const [index, partner] of SEED_PARTNERS.entries()) {
    const data = { name: partner.name, url: null, description: partner.description, order: index, published: partner.published };
    await prisma.partner.upsert({
      where: { id: partner.id },
      create: { id: partner.id, ...data },
      update: overwrite ? data : {},
    });
  }
  console.log(`  partners: ${SEED_PARTNERS.length}`);
}

async function seedSettings(media: Record<SeedMediaKey, string>): Promise<void> {
  const data = {
    phone: SEED_SETTINGS.phone,
    email: SEED_SETTINGS.email,
    address: SEED_SETTINGS.address,
    socials: SEED_SETTINGS.socials.map((social) => ({ type: social.type, url: social.url })),
    seoTitle: SEED_SETTINGS.seoTitle,
    seoDescription: SEED_SETTINGS.seoDescription,
    ogImageId: media[SEED_SETTINGS.ogImage],
  };
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: overwrite ? data : {},
  });
  console.log("  site settings (placeholder contacts)");
}

/** The SiteSettings row is written last by a successful first seed: it marks the DB as seeded. */
async function isSeeded(): Promise<boolean> {
  return (await prisma.siteSettings.count({ where: { id: 1 } })) > 0;
}

async function main(): Promise<void> {
  console.log(`Seeding${overwrite ? " (SEED_OVERWRITE=1: resetting seeded rows)" : ""}…`);
  const seeded = await isSeeded();
  const seedEntities = overwrite || !seeded;

  // Media to create: everything on a first run; on a re-run only images of new content blocks.
  const missingKeys = await missingContentKeys();
  const neededMedia = new Set<SeedMediaKey>(
    seedEntities
      ? (Object.keys(SEED_MEDIA) as SeedMediaKey[])
      : CONTENT_KEYS.filter((key) => missingKeys.has(key)).flatMap((key) => (isImageKey(key) ? [CONTENT_IMAGES[key]] : [])),
  );
  const media = await seedMedia(neededMedia);
  await seedContentBlocks(media);

  if (!seedEntities) {
    console.log(
      "  entities: database already seeded — collections, products, reviews, news, gallery, offers, partners and settings are left as edited in the admin (SEED_OVERWRITE=1 resets them)",
    );
    console.log("Seed complete.");
    return;
  }

  const allMedia = requireAllMedia(media);
  await seedCatalog(allMedia);
  await seedReviews();
  await seedNews(allMedia);
  await seedGallery(allMedia);
  await seedOffers(allMedia);
  await seedPartners();
  await seedSettings(allMedia);
  console.log("Seed complete.");
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
