/**
 * Rules of the admin catalog forms (port of the frontend's zod schemas, src/lib/admin/schemas.ts):
 * collections, products, reviews and the site settings.
 */

/** Upper bound of a product price, whole rubles (the product form checks it before sending too). */
export const PRICE_MAX = 100_000_000;

/** Most photos of one product. */
export const MAX_PRODUCT_IMAGES = 30;

/** Settings phone: digits, spaces and + ( ) . - only ("" = none). */
export const PHONE_PATTERN = /^[0-9+()\s.-]*$/;

/** E-mail address of the settings (the pattern the old zod schema used, z.email()). */
export const EMAIL_PATTERN =
  /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

/** Length limits of the catalog's text fields (characters, per translation for LocalizedText). */
export const CATALOG_TEXT_LIMITS = {
  TITLE: 200,
  DESCRIPTION: 5000,
  REVIEW_AUTHOR: 120,
  REVIEW_ROLE: 120,
  REVIEW_TEXT: 3000,
  ADDRESS: 300,
  SEO_TITLE: 120,
  SEO_DESCRIPTION: 400,
  PHONE: 40,
  EMAIL: 200,
} as const;
