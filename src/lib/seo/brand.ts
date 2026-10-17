import type { Locale } from "@/i18n/locales";

/** Brand constants used by metadata, JSON-LD and the web manifest (isomorphic). */
export const BRAND = {
  name: "ГАДЮКА",
  alternateName: "GADYUKA",
  /** The brand as written in each language's titles («… — ГАДЮКА» / «… — GADYUKA»). */
  displayName: { ru: "ГАДЮКА", en: "GADYUKA" },
  slogan: { ru: "Меня запомнят", en: "They will remember me" },
  city: { ru: "Краснодар", en: "Krasnodar" },
  countryCode: "RU",
  currency: "RUB",
  colors: {
    black: "#010101",
    beige: "#E2CCA7",
    blue: "#2A344F",
    grey: "#8B8B8B",
    red: "#C30022",
  },
} as const satisfies {
  name: string;
  alternateName: string;
  displayName: Record<Locale, string>;
  slogan: Record<Locale, string>;
  city: Record<Locale, string>;
  countryCode: string;
  currency: string;
  colors: Record<string, string>;
};

/** Brand name for page titles, og:site_name and alt fallbacks in `locale` (Latin on the English site). */
export function brandName(locale: Locale): string {
  return BRAND.displayName[locale];
}

/**
 * Default share image: public/opengraph-image.png (1200×630, generated from the brand
 * SVGs), served statically at /opengraph-image.png. Used when SiteSettings.ogImage is empty.
 * Deliberately NOT the app/opengraph-image.png file convention: that would inject an
 * og:image into every route (admin, bare 404), while compose.ts already sets it explicitly.
 */
export const DEFAULT_OG_IMAGE = {
  path: "/opengraph-image.png",
  width: 1200,
  height: 630,
  type: "image/png",
} as const;

/** App icon (src/app/icon.png, 512×512, black logo on brand red) — used as the JSON-LD logo. */
export const BRAND_LOGO = { path: "/icon.png", width: 512, height: 512 } as const;

/**
 * Seed / demo contact values must not leak into structured data.
 * Matches «заглушка», "placeholder", example.* domains and all-zero phone numbers.
 */
export function isPlaceholderValue(value: string): boolean {
  const text = value.trim();
  if (!text) return true;
  if (/заглушк|placeholder|example\.(com|org|net|ru)/i.test(text)) return true;
  const digits = text.replace(/\D/g, "");
  return /^[78]?0{7,}$/.test(digits) && /\d/.test(text) && !/[a-zа-яё]/i.test(text);
}
