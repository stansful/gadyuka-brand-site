import type { SocialType as DbSocialType } from '../../generated/prisma/enums';

/**
 * Social network types of SocialLink rows — ISOMORPHIC and zod-free, so client code
 * (src/components/site/format.ts → the contacts, the admin forms) does not pull zod or the
 * Prisma client into every page. The values ARE the Prisma enum `SocialType` ("TELEGRAM", …),
 * listed here in the admin's display order. The default label of each type is the site message
 * `social.<TYPE>` (messages/<locale>.json), used when SocialLink.label is empty. ./schemas
 * re-exports both.
 */
export const SOCIAL_TYPES = [
  'TELEGRAM',
  'VK',
  'INSTAGRAM',
  'WHATSAPP',
  'YOUTUBE',
  'TIKTOK',
  'PINTEREST',
  'WEBSITE',
  'OTHER',
] as const satisfies ReadonlyArray<DbSocialType>;

export type SocialType = (typeof SOCIAL_TYPES)[number];

/** Compile-time check: the list above covers the whole Prisma enum. */
const everyTypeListed: [Exclude<DbSocialType, SocialType>] extends [never] ? true : false = true;
void everyTypeListed;

export function isSocialType(value: unknown): value is SocialType {
  return typeof value === 'string' && SOCIAL_TYPES.some(type => type === value);
}
