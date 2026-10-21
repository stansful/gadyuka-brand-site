/**
 * Typed content read layer (server-only): the backend's public API (/api/v1/public/*), cached.
 *
 *   import { getLanding, type LandingContent } from "@/lib/content";
 *   const content = await getLanding(locale);
 *   content.texts["hero.slogan"]; content.images["about.image"]?.src; content.menu; content.socials;
 *
 * Site messages alone (next-intl uses them too): getSiteMessages / getSiteTexts from
 * "@/i18n/site-messages". Admin writes: the Server Action ends with updateTag('content')
 * (adminApiAction `revalidatesContent`, src/lib/api/admin-action.ts).
 */
export { getLanding, getSiteSettings, getCollectionBySlug } from './landing';
export {
  CACHE_TAGS,
  CONTENT_CACHE_LIFE,
  markContentStale,
  revalidateContent,
  revalidateContentFromRoute,
  type CacheTag,
} from './cache';
export type * from './types';
export {
  CHAPTER_ORDER,
  CONTENT_IMAGES,
  IMAGE_KEYS,
  LEAD_FORM_ANCHOR,
  MESSAGE_KEYS,
  SECTION_ANCHORS,
  TEXT_KEYS,
  chapterNumber,
  isImageKey,
  isMessageKey,
  isSectionId,
  type ChapterId,
  type ImageKey,
  type MessageKey,
  type SectionId,
  type TextKey,
} from './registry';
export { SOCIAL_TYPES, isSocialType, type SocialType } from './social';
