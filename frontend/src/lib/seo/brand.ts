import { defaultLocale, type Locale } from '@/i18n/locales';

/**
 * Brand constants that are not copy (isomorphic): codes for structured data and the colours
 * of the web manifest. The brand's NAME, CITY and the page-title template are site messages
 * (brand.* — editable in the admin, see BrandCopy / ./brand-copy.ts); the slogan is the
 * cover's message hero.slogan.
 */
export const BRAND = {
  countryCode: 'RU',
  currency: 'RUB',
  colors: {
    black: '#010101',
    beige: '#E2CCA7',
    blue: '#2A344F',
    grey: '#8B8B8B',
    red: '#C30022',
  },
} as const satisfies {
  countryCode: string;
  currency: string;
  colors: Record<string, string>;
};

/** The brand as the site messages spell it (resolved on the server: getBrandCopy in ./brand-copy.ts). */
export type BrandCopy = {
  /** brand.name in the page's locale («ГАДЮКА» / «GADYUKA»): titles, og:site_name, alt fallbacks. */
  name: string;
  /** brand.name in every locale: the organization's name (default locale) and its other spellings. */
  names: Readonly<Record<Locale, string>>;
  /** brand.city in the page's locale (JSON-LD addressLocality; "" = left out). */
  city: string;
  /**
   * brand.pageTitle filled with the brand and a "%s" for the page («%s — ГАДЮКА»): Next.js'
   * title template, and pageTitle() below.
   */
  titleTemplate: string;
};

/** «Меня запомнят — ГАДЮКА»: a page title in the brand's title template. */
export function pageTitle(brand: Pick<BrandCopy, 'titleTemplate'>, title: string): string {
  return brand.titleTemplate.replace('%s', () => title);
}

/** The organization's own name (the default locale's spelling, «ГАДЮКА») — the same on every page. */
export function organizationName(brand: Pick<BrandCopy, 'names'>): string {
  return brand.names[defaultLocale];
}

/** The other spellings of the brand than `name` («GADYUKA» next to «ГАДЮКА»), without repeats. */
export function alternateBrandNames(brand: Pick<BrandCopy, 'names'>, name: string): string[] {
  const others: string[] = [];
  for (const other of Object.values(brand.names)) {
    if (other && other !== name && !others.includes(other)) others.push(other);
  }
  return others;
}

/**
 * Default share image: public/opengraph-image.png (1200×630, generated from the brand
 * SVGs), served statically at /opengraph-image.png. Used when SiteSettings.ogImage is empty.
 * Deliberately NOT the app/opengraph-image.png file convention: that would inject an
 * og:image into every route (admin, bare 404), while compose.ts already sets it explicitly.
 */
export const DEFAULT_OG_IMAGE = {
  path: '/opengraph-image.png',
  width: 1200,
  height: 630,
  type: 'image/png',
} as const;

/** App icon (src/app/icon.png, 512×512, black logo on brand red) — used as the JSON-LD logo. */
export const BRAND_LOGO = { path: '/icon.png', width: 512, height: 512 } as const;

/**
 * Seed / demo contact values must not leak into structured data.
 * Matches «заглушка», "placeholder", example.* domains and all-zero phone numbers.
 */
export function isPlaceholderValue(value: string): boolean {
  const text = value.trim();
  if (!text) return true;
  if (/заглушк|placeholder|example\.(com|org|net|ru)/i.test(text)) return true;
  const digits = text.replace(/\D/g, '');
  return /^[78]?0{7,}$/.test(digits) && /\d/.test(text) && !/[a-zа-яё]/i.test(text);
}
