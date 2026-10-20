import type { PrismaClient } from '@/generated/prisma/client';
import type { SeedMediaKey } from '../seed-data/media';

import { defaultLocale } from '@/i18n/locales';
import { readText } from '@/lib/i18n-text';
import {
  SEED_COLLECTION,
  SEED_GALLERY,
  SEED_MENU,
  SEED_NEWS,
  SEED_OFFERS,
  SEED_PARTNERS,
  SEED_PRODUCTS,
  SEED_REVIEWS,
  SEED_SETTINGS,
  SEED_SOCIALS,
} from '../seed-data/entities';

/**
 * Demo entities: the collection «Меня запомнят» with products, reviews, news, gallery, offers,
 * partners, the menu, the social links and the settings. Seeded on the FIRST run only (or reset
 * with SEED_OVERWRITE=1): afterwards they belong to the admin — deletions, renamed slugs,
 * re-ordered photos and unpublished items survive a re-seed. Every upsert therefore uses
 * `update: overwrite ? data : {}`. The SiteSettings row is written last: it marks the database
 * as seeded (isSeeded).
 */

type EntitySeedOptions = { overwrite: boolean };
type SeedMediaIds = Readonly<Record<SeedMediaKey, string>>;

/** The SiteSettings row is written last by a successful first seed: it marks the DB as seeded. */
export async function isSeeded(prisma: PrismaClient): Promise<boolean> {
  return (await prisma.siteSettings.count({ where: { id: 1 } })) > 0;
}

async function seedCatalog(prisma: PrismaClient, media: SeedMediaIds, { overwrite }: EntitySeedOptions): Promise<void> {
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
        prisma.productImage.createMany({ data: images.map(image => ({ productId: existing.id, ...image })) }),
      ]);
    }
    // else: the product exists and was possibly edited in the admin — leave it (and its photos) alone.
  }
  console.log(`  collection «${readText(SEED_COLLECTION.title, defaultLocale)}» with ${SEED_PRODUCTS.length} products`);
}

async function seedReviews(prisma: PrismaClient, { overwrite }: EntitySeedOptions): Promise<void> {
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

async function seedNews(prisma: PrismaClient, media: SeedMediaIds, { overwrite }: EntitySeedOptions): Promise<void> {
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

async function seedGallery(prisma: PrismaClient, media: SeedMediaIds, { overwrite }: EntitySeedOptions): Promise<void> {
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

async function seedOffers(prisma: PrismaClient, media: SeedMediaIds, { overwrite }: EntitySeedOptions): Promise<void> {
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

async function seedPartners(prisma: PrismaClient, { overwrite }: EntitySeedOptions): Promise<void> {
  for (const [index, partner] of SEED_PARTNERS.entries()) {
    const data = {
      name: partner.name,
      url: null,
      description: partner.description,
      order: index,
      published: partner.published,
    };
    await prisma.partner.upsert({
      where: { id: partner.id },
      create: { id: partner.id, ...data },
      update: overwrite ? data : {},
    });
  }
  console.log(`  partners: ${SEED_PARTNERS.length} (drafts)`);
}

async function seedMenu(prisma: PrismaClient, { overwrite }: EntitySeedOptions): Promise<void> {
  for (const [index, item] of SEED_MENU.entries()) {
    const data = {
      label: item.label,
      href: item.href,
      showInHeader: item.showInHeader,
      showInFooter: item.showInFooter,
      order: index,
      published: true,
    };
    await prisma.menuItem.upsert({
      where: { id: item.id },
      create: { id: item.id, ...data },
      update: overwrite ? data : {},
    });
  }
  console.log(`  menu: ${SEED_MENU.length} items`);
}

async function seedSocials(prisma: PrismaClient, { overwrite }: EntitySeedOptions): Promise<void> {
  for (const [index, link] of SEED_SOCIALS.entries()) {
    const data = { type: link.type, label: link.label, url: link.url, order: index, published: link.published };
    await prisma.socialLink.upsert({
      where: { id: link.id },
      create: { id: link.id, ...data },
      update: overwrite ? data : {},
    });
  }
  console.log(`  social links: ${SEED_SOCIALS.length} (placeholder URL)`);
}

async function seedSettings(
  prisma: PrismaClient,
  media: SeedMediaIds,
  { overwrite }: EntitySeedOptions,
): Promise<void> {
  const data = {
    phone: SEED_SETTINGS.phone,
    email: SEED_SETTINGS.email,
    address: SEED_SETTINGS.address,
    reviewRatingMax: SEED_SETTINGS.reviewRatingMax,
    seoTitle: SEED_SETTINGS.seoTitle,
    seoDescription: SEED_SETTINGS.seoDescription,
    ogImageId: media[SEED_SETTINGS.ogImage],
  };
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: overwrite ? data : {},
  });
  console.log(`  site settings (placeholder contacts, ${SEED_SETTINGS.reviewRatingMax}-star reviews)`);
}

/** Every demo entity; the settings row last (it marks the database as seeded). */
export async function seedEntities(
  prisma: PrismaClient,
  media: SeedMediaIds,
  options: EntitySeedOptions,
): Promise<void> {
  await seedCatalog(prisma, media, options);
  await seedReviews(prisma, options);
  await seedNews(prisma, media, options);
  await seedGallery(prisma, media, options);
  await seedOffers(prisma, media, options);
  await seedPartners(prisma, options);
  await seedMenu(prisma, options);
  await seedSocials(prisma, options);
  await seedSettings(prisma, media, options);
}
