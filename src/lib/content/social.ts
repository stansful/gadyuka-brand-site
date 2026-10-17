/**
 * Social network types of SiteSettings.socials — ISOMORPHIC and zod-free, so client code
 * (src/components/site/format.ts → the header, the gallery) does not pull zod into every
 * public page. ./schemas re-exports both.
 */
export const SOCIAL_TYPES = [
  "telegram",
  "vk",
  "instagram",
  "whatsapp",
  "youtube",
  "tiktok",
  "pinterest",
  "website",
  "other",
] as const;

export type SocialType = (typeof SOCIAL_TYPES)[number];
