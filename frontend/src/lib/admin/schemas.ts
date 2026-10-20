import { z } from 'zod';

import { LeadStatus } from '@/generated/prisma/enums';
import { locales } from '@/i18n/locales';
import { SOCIAL_TYPES } from '@/lib/content/social';
import { localizedTextSchema, requiredLocalizedTextSchema, type LocalizedText } from '@/lib/i18n-text';

import { errorKey } from './i18n';

/**
 * Write-side zod schemas of every admin form (isomorphic: the same types drive the
 * client form state and the Server Action validation). Server Actions always
 * re-validate — the client types are only a convenience.
 *
 * Issue messages are admin.validation keys (errorKey), translated by parseInput
 * (./validation.ts) with the issue's {min} / {max} / custom params. Length limits of
 * strings need no message: a too long string gets the generic «Не длиннее {max} символов».
 * Except after a schema with its own error (z.url(…), z.email(…), z.number(…)): a chained
 * check without a message inherits that error («Укажите ссылку…» for a too long URL), so
 * each such check names its key.
 */

// ── primitives ────────────────────────────────────────────────────────────────

/** Row ids: cuid() or deterministic seed ids ("seed-review-1"). */
export const idSchema = z
  .string()
  .trim()
  .min(1, errorKey('idRequired'))
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, errorKey('idInvalid'));

export const mediaIdSchema = idSchema.nullable();

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, errorKey('slugRequired'))
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, errorKey('slugFormat'));

/** LocalizedText with a per-translation length limit (errors point at "<field>.<locale>"). */
function limited<S extends z.ZodType<LocalizedText>>(schema: S, max: number): S {
  return schema.superRefine((value, ctx) => {
    for (const locale of locales) {
      const text = value[locale];
      if (text !== undefined && text.length > max) {
        ctx.addIssue({ code: 'custom', path: [locale], message: errorKey('tooLong'), params: { max } });
      }
    }
  });
}

export const shortText = (max = 300) => limited(localizedTextSchema, max);
export const requiredShortText = (max = 300) => limited(requiredLocalizedTextSchema, max);
export const longText = (max = 10_000) => limited(localizedTextSchema, max);
export const requiredLongText = (max = 10_000) => limited(requiredLocalizedTextSchema, max);

/** "YYYY-MM-DD" from an <input type="date">. */
export const dateInputSchema = z.iso.date({ error: errorKey('dateRequired') });

/** Links on the site: absolute http(s), site-relative "/…", anchors "#…", mailto:, tel:. Never javascript:. */
export const siteHrefSchema = z
  .string()
  .trim()
  .max(500)
  .regex(/^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*|#[A-Za-z0-9_-]*|mailto:[^\s]+|tel:[+0-9()\s-]+)$/, errorKey('siteHref'));

export const httpUrlSchema = z.url({ protocol: /^https?$/, error: errorKey('httpUrl') }).max(500, errorKey('tooLong'));

const publishedSchema = z.boolean();

// ── entities ──────────────────────────────────────────────────────────────────

export const collectionInputSchema = z.object({
  slug: slugSchema,
  title: requiredShortText(200),
  description: longText(5000),
  coverId: mediaIdSchema,
  published: publishedSchema,
});
export type CollectionInput = z.input<typeof collectionInputSchema>;

/** Upper bound of a product price, ₽ (the product form checks it before sending too). */
export const PRICE_MAX = 100_000_000;

export const productInputSchema = z.object({
  slug: slugSchema,
  collectionId: idSchema,
  title: requiredShortText(200),
  description: longText(5000),
  details: longText(5000),
  // The bounds come before .int(): a number past the safe integer range fails both, and the
  // first issue (the one shown) should be the upper bound, not «целое число».
  price: z
    .number(errorKey('priceInteger'))
    .min(0, errorKey('priceNegative'))
    .max(PRICE_MAX, errorKey('priceTooHigh'))
    .int(errorKey('priceInteger'))
    .nullable(),
  imageIds: z
    .array(idSchema)
    .max(30, errorKey('photosTooMany'))
    .refine(ids => new Set(ids).size === ids.length, errorKey('photosDuplicate')),
  published: publishedSchema,
});
export type ProductInput = z.input<typeof productInputSchema>;

/**
 * Hard limits of the review star scale (SiteSettings.reviewRatingMax, CHECK 1..10 in the
 * migration). The CURRENT scale is a setting: saveReview checks a rating against it.
 */
export const REVIEW_RATING_LIMIT = { min: 1, max: 10 } as const;

/** Default star scale (= the SiteSettings column default) when the settings row is missing. */
export const DEFAULT_REVIEW_RATING_MAX = 5;

export const reviewInputSchema = z.object({
  author: z.string().trim().min(1, errorKey('authorRequired')).max(120),
  role: shortText(120),
  text: requiredLongText(3000),
  avatarId: mediaIdSchema,
  /** 1..SiteSettings.reviewRatingMax — the upper bound is checked in saveReview. */
  rating: z
    .int(errorKey('ratingInteger'))
    .min(REVIEW_RATING_LIMIT.min, errorKey('ratingTooLow'))
    .max(REVIEW_RATING_LIMIT.max, errorKey('ratingTooHigh'))
    .nullable(),
  published: publishedSchema,
});
export type ReviewInput = z.input<typeof reviewInputSchema>;

export const newsInputSchema = z.object({
  slug: slugSchema,
  title: requiredShortText(200),
  excerpt: longText(1000),
  body: longText(20_000),
  date: dateInputSchema,
  imageId: mediaIdSchema,
  published: publishedSchema,
});
export type NewsInput = z.input<typeof newsInputSchema>;

export const galleryInputSchema = z.object({
  mediaId: idSchema,
  caption: shortText(300),
  published: publishedSchema,
});
export type GalleryInput = z.input<typeof galleryInputSchema>;

export const offerInputSchema = z.object({
  title: requiredShortText(200),
  text: longText(3000),
  badge: shortText(40),
  ctaLabel: shortText(60),
  ctaHref: siteHrefSchema.nullable(),
  validUntil: dateInputSchema.nullable(),
  imageId: mediaIdSchema,
  published: publishedSchema,
});
export type OfferInput = z.input<typeof offerInputSchema>;

export const partnerInputSchema = z.object({
  name: z.string().trim().min(1, errorKey('nameRequired')).max(120),
  url: httpUrlSchema.nullable(),
  logoId: mediaIdSchema,
  description: longText(3000),
  published: publishedSchema,
});
export type PartnerInput = z.input<typeof partnerInputSchema>;

/** Site menu item (MenuItem): header and/or footer link. */
export const menuItemInputSchema = z.object({
  label: requiredShortText(80),
  href: z
    .string()
    .trim()
    .min(1, errorKey('hrefRequired'))
    .pipe(siteHrefSchema)
    .refine(href => href !== '#', errorKey('hrefBareHash')),
  showInHeader: z.boolean(),
  showInFooter: z.boolean(),
  published: publishedSchema,
});
export type MenuItemInput = z.input<typeof menuItemInputSchema>;

export const socialTypeSchema = z.enum(SOCIAL_TYPES, { error: errorKey('socialType') });

/** Social / messenger link (SocialLink). An empty label = the default name of the type. */
export const socialLinkInputSchema = z.object({
  type: socialTypeSchema,
  url: httpUrlSchema,
  label: shortText(60),
  published: publishedSchema,
});
export type SocialLinkInput = z.input<typeof socialLinkInputSchema>;

export const settingsInputSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[0-9+()\s.-]*$/, errorKey('phoneFormat')),
  email: z.union([z.literal(''), z.email(errorKey('email')).max(200, errorKey('tooLong'))]),
  address: shortText(300),
  reviewRatingMax: z
    .int(errorKey('starsInteger'))
    .refine(value => value >= REVIEW_RATING_LIMIT.min && value <= REVIEW_RATING_LIMIT.max, {
      error: errorKey('starsRange'),
      params: { ...REVIEW_RATING_LIMIT },
    }),
  seoTitle: shortText(120),
  seoDescription: shortText(400),
  ogImageId: mediaIdSchema,
});
export type SettingsInput = z.input<typeof settingsInputSchema>;

// ── site texts (Message rows) & landing images (ContentImage rows) ────────────

/** Max length of one site text in one language (Message.value). */
export const SITE_TEXT_MAX_LENGTH = 10_000;

/**
 * «Тексты сайта» save: the texts the editor changed — each submitted language with its value
 * and `base`, the stored text the edit started from (the action refuses the save when a row
 * no longer holds it: changed in another tab or session meanwhile) — plus the landing images
 * the owner picked, each with the media it replaced. Values are trimmed but NOT dropped when
 * empty — an empty Russian text hides an optional element, an empty translation shows the
 * Russian text; the base is compared as stored (untrimmed). A locale missing from `values` is
 * left untouched. Keys, required texts and ICU templates are checked by the action
 * (src/lib/admin/site-texts.ts), conflicts by src/lib/admin/site-text-save.ts.
 */
export const siteTextsInputSchema = z.object({
  entries: z
    .array(
      z.object({
        key: z.string().trim().min(1, errorKey('keyRequired')).max(200),
        values: z.partialRecord(
          z.enum(locales),
          z.object({
            value: z.string().trim().max(SITE_TEXT_MAX_LENGTH),
            base: z.string().max(SITE_TEXT_MAX_LENGTH),
          }),
        ),
      }),
    )
    .max(500, errorKey('tooManyTexts'))
    .refine(entries => new Set(entries.map(entry => entry.key)).size === entries.length, errorKey('textsDuplicate')),
  images: z
    .array(z.object({ key: z.string().trim().min(1).max(100), mediaId: mediaIdSchema, base: mediaIdSchema }))
    .max(20)
    .refine(images => new Set(images.map(image => image.key)).size === images.length, errorKey('imagesDuplicate')),
});
export type SiteTextsInput = z.input<typeof siteTextsInputSchema>;

// ── media, leads, lists ───────────────────────────────────────────────────────

export const mediaAltInputSchema = z.object({ id: idSchema, alt: shortText(300) });

export const leadStatusSchema = z.enum(LeadStatus);

export const ORDERABLE_ENTITIES = [
  'collection',
  'product',
  'review',
  'gallery',
  'offer',
  'partner',
  'menuItem',
  'socialLink',
] as const;
export type OrderableEntity = (typeof ORDERABLE_ENTITIES)[number];
export const PUBLISHABLE_ENTITIES = [...ORDERABLE_ENTITIES, 'news'] as const;
export type PublishableEntity = (typeof PUBLISHABLE_ENTITIES)[number];

export const orderableEntitySchema = z.enum(ORDERABLE_ENTITIES);
export const publishableEntitySchema = z.enum(PUBLISHABLE_ENTITIES);

export const reorderInputSchema = z.object({
  entity: orderableEntitySchema,
  ids: z
    .array(idSchema)
    .min(1)
    .max(1000)
    .refine(ids => new Set(ids).size === ids.length, errorKey('listDuplicate')),
});

// ── date helpers (all dates are entered and shown in Moscow time, like the site) ──

const MOSCOW_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Moscow',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Date → "YYYY-MM-DD" (Moscow) for <input type="date">. */
export function toDateInputValue(date: Date | string): string {
  return MOSCOW_DATE.format(typeof date === 'string' ? new Date(date) : date);
}

/** "YYYY-MM-DD" → noon Moscow time (stable against time-zone shifts). */
export function newsDateFromInput(value: string): Date {
  return new Date(`${value}T12:00:00.000+03:00`);
}

/** "YYYY-MM-DD" → the last millisecond of that day in Moscow (offer stays valid through the whole day). */
export function endOfDayFromInput(value: string): Date {
  return new Date(`${value}T23:59:59.999+03:00`);
}
