import { z } from "zod";
import { LeadStatus } from "@/generated/prisma/enums";
import { locales } from "@/i18n/locales";
import { localizedTextSchema, requiredLocalizedTextSchema, type LocalizedText } from "@/lib/i18n-text";
import { CONTENT_SECTIONS, type SectionId } from "@/lib/content/registry";
import { SOCIAL_TYPES } from "@/lib/content/schemas";

/**
 * Write-side zod schemas of every admin form (isomorphic: the same types drive the
 * client form state and the Server Action validation). Server Actions always
 * re-validate — the client types are only a convenience.
 */

// ── primitives ────────────────────────────────────────────────────────────────

/** Row ids: cuid() or deterministic seed ids ("seed-review-1"). */
export const idSchema = z
  .string()
  .trim()
  .min(1, "Не указан идентификатор")
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Некорректный идентификатор");

export const mediaIdSchema = idSchema.nullable();

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Укажите адрес (slug)")
  .max(120, "Не длиннее 120 символов")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Только латиница, цифры и дефисы, например: menya-zapomnyat");

/** LocalizedText with a per-translation length limit (errors point at "<field>.<locale>"). */
function limited<S extends z.ZodType<LocalizedText>>(schema: S, max: number): S {
  return schema.superRefine((value, ctx) => {
    for (const locale of locales) {
      const text = value[locale];
      if (text !== undefined && text.length > max) {
        ctx.addIssue({ code: "custom", path: [locale], message: `Не длиннее ${max} символов` });
      }
    }
  });
}

export const shortText = (max = 300) => limited(localizedTextSchema, max);
export const requiredShortText = (max = 300) => limited(requiredLocalizedTextSchema, max);
export const longText = (max = 10_000) => limited(localizedTextSchema, max);
export const requiredLongText = (max = 10_000) => limited(requiredLocalizedTextSchema, max);

/** "YYYY-MM-DD" from an <input type="date">. */
export const dateInputSchema = z.iso.date({ error: "Укажите дату" });

/** Links on the site: absolute http(s), site-relative "/…", anchors "#…", mailto:, tel:. Never javascript:. */
export const siteHrefSchema = z
  .string()
  .trim()
  .max(500, "Не длиннее 500 символов")
  .regex(/^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*|#[A-Za-z0-9_-]*|mailto:[^\s]+|tel:[+0-9()\s-]+)$/, "Ссылка должна начинаться с https://, / или #");

export const httpUrlSchema = z.url({ protocol: /^https?$/, error: "Укажите ссылку вида https://…" }).max(500);

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

export const productInputSchema = z.object({
  slug: slugSchema,
  collectionId: idSchema,
  title: requiredShortText(200),
  description: longText(5000),
  details: longText(5000),
  price: z.int("Цена — целое число рублей").min(0, "Цена не может быть отрицательной").max(100_000_000).nullable(),
  imageIds: z
    .array(idSchema)
    .max(30, "Не больше 30 фото")
    .refine((ids) => new Set(ids).size === ids.length, "Фото повторяются"),
  published: publishedSchema,
});
export type ProductInput = z.input<typeof productInputSchema>;

export const reviewInputSchema = z.object({
  author: z.string().trim().min(1, "Укажите автора").max(120, "Не длиннее 120 символов"),
  role: shortText(120),
  text: requiredLongText(3000),
  avatarId: mediaIdSchema,
  rating: z.int().min(1, "Оценка от 1 до 5").max(5, "Оценка от 1 до 5").nullable(),
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
  name: z.string().trim().min(1, "Укажите название").max(120, "Не длиннее 120 символов"),
  url: httpUrlSchema.nullable(),
  logoId: mediaIdSchema,
  description: longText(3000),
  published: publishedSchema,
});
export type PartnerInput = z.input<typeof partnerInputSchema>;

export const socialTypeSchema = z.enum(SOCIAL_TYPES, { error: "Выберите соцсеть" });

export const settingsInputSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(40, "Не длиннее 40 символов")
    .regex(/^[0-9+()\s.-]*$/, "Только цифры, пробелы и символы + ( ) -"),
  email: z.union([z.literal(""), z.email("Некорректный e-mail").max(200)]),
  address: shortText(300),
  socials: z.array(z.object({ type: socialTypeSchema, url: httpUrlSchema })).max(20, "Не больше 20 ссылок"),
  seoTitle: shortText(120),
  seoDescription: shortText(400),
  ogImageId: mediaIdSchema,
});
export type SettingsInput = z.input<typeof settingsInputSchema>;

// ── content blocks ────────────────────────────────────────────────────────────

export function isSectionId(value: unknown): value is SectionId {
  return typeof value === "string" && CONTENT_SECTIONS.some((section) => section.id === value);
}

export const sectionIdSchema = z.custom<SectionId>(isSectionId, "Неизвестный раздел");

export const contentSectionInputSchema = z.object({
  section: sectionIdSchema,
  blocks: z
    .array(
      z.object({
        key: z.string().min(1).max(120),
        value: longText(20_000).optional(),
        mediaId: mediaIdSchema.optional(),
      }),
    )
    .max(200),
});
export type ContentSectionInput = z.input<typeof contentSectionInputSchema>;

// ── media, leads, lists ───────────────────────────────────────────────────────

export const mediaAltInputSchema = z.object({ id: idSchema, alt: shortText(300) });

export const leadStatusSchema = z.enum(LeadStatus);

export const ORDERABLE_ENTITIES = ["collection", "product", "review", "gallery", "offer", "partner"] as const;
export type OrderableEntity = (typeof ORDERABLE_ENTITIES)[number];
export const PUBLISHABLE_ENTITIES = [...ORDERABLE_ENTITIES, "news"] as const;
export type PublishableEntity = (typeof PUBLISHABLE_ENTITIES)[number];

export const orderableEntitySchema = z.enum(ORDERABLE_ENTITIES);
export const publishableEntitySchema = z.enum(PUBLISHABLE_ENTITIES);

export const reorderInputSchema = z.object({
  entity: orderableEntitySchema,
  ids: z
    .array(idSchema)
    .min(1)
    .max(1000)
    .refine((ids) => new Set(ids).size === ids.length, "Список содержит повторы"),
});

// ── date helpers (all dates are entered and shown in Moscow time, like the site) ──

const MOSCOW_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Moscow",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Date → "YYYY-MM-DD" (Moscow) for <input type="date">. */
export function toDateInputValue(date: Date | string): string {
  return MOSCOW_DATE.format(typeof date === "string" ? new Date(date) : date);
}

/** "YYYY-MM-DD" → noon Moscow time (stable against time-zone shifts). */
export function newsDateFromInput(value: string): Date {
  return new Date(`${value}T12:00:00.000+03:00`);
}

/** "YYYY-MM-DD" → the last millisecond of that day in Moscow (offer stays valid through the whole day). */
export function endOfDayFromInput(value: string): Date {
  return new Date(`${value}T23:59:59.999+03:00`);
}
