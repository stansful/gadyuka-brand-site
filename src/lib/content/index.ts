/**
 * Typed content read layer (server-only).
 *
 *   import { getLanding, type LandingContent } from "@/lib/content";
 *   const content = await getLanding(locale);
 *   content.texts["hero.slogan"]; content.images["about.image"]?.src; content.menu; content.socials;
 *
 * Site messages alone (next-intl uses them too): getSiteMessages / getSiteTexts from
 * "@/i18n/site-messages". Admin writes: call revalidateContent() at the end of the Server Action.
 */
export { getLanding, getSiteSettings, getCollectionBySlug, getPublishedCollectionSlugs } from './landing';
export { CACHE_TAGS, CONTENT_CACHE_LIFE, revalidateContent, revalidateContentFromRoute, type CacheTag } from './cache';
export type * from './types';
export {
  CHAPTER_ORDER,
  CONTENT_IMAGES,
  CONTENT_SECTIONS,
  IMAGE_KEYS,
  LEAD_FORM_ANCHOR,
  MESSAGE_KEYS,
  SECTION_ANCHORS,
  TEXT_KEYS,
  chapterNumber,
  isImageKey,
  isMessageKey,
  isRequiredKey,
  isSectionId,
  messageDefinition,
  messageKind,
  messageSection,
  sectionImageKeys,
  sectionMessageDefinitions,
  sectionMessageKeys,
  type ChapterId,
  type ImageKey,
  type MessageDefinition,
  type MessageKey,
  type MessageKind,
  type SectionId,
  type TextKey,
} from './registry';
export { SOCIAL_TYPES, isSocialType, type SocialType } from './social';
