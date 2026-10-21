import type { SocialType as ApiSocialType } from '@shared/contracts/content-entities';

/**
 * Social network types of SocialLink rows — ISOMORPHIC and dependency-free, so client code
 * (src/components/site/format.ts → the contacts, the admin forms) can import it. The values ARE
 * the API's `SocialType` ("TELEGRAM", …; shared/contracts/content-entities.ts = the backend's
 * enum), listed here in the admin's display order. The default label of each type is the site
 * message `social.<TYPE>` (shared/messages/<locale>.json), used when SocialLink.label is empty.
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
] as const satisfies ReadonlyArray<ApiSocialType>;

export type SocialType = (typeof SOCIAL_TYPES)[number];

/** Compile-time check: the list above covers every type of the API. */
const everyTypeListed: [Exclude<ApiSocialType, SocialType>] extends [never] ? true : false = true;
void everyTypeListed;

export function isSocialType(value: unknown): value is SocialType {
  return typeof value === 'string' && SOCIAL_TYPES.some(type => type === value);
}
