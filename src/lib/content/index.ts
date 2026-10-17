/**
 * Typed content read layer (server-only).
 *
 *   import { getLanding, type LandingContent } from "@/lib/content";
 *   const content = await getLanding(locale);
 *   content.texts["hero.slogan"]; content.images["about.image"]?.src;
 *
 * Admin writes: call revalidateContent() at the end of the Server Action.
 */
export { getLanding, getSiteSettings, getCollectionBySlug, getPublishedCollectionSlugs } from "./landing";
export { CACHE_TAGS, CONTENT_CACHE_LIFE, revalidateContent, revalidateContentFromRoute, type CacheTag } from "./cache";
export type * from "./types";
export {
  CHAPTER_ORDER,
  CONTENT_BLOCKS,
  CONTENT_KEYS,
  CONTENT_SECTIONS,
  IMAGE_KEYS,
  LEAD_FORM_ANCHOR,
  SECTION_ANCHORS,
  TEXT_KEYS,
  chapterNumber,
  contentKeyOrder,
  isContentKey,
  isImageKey,
  isTextKey,
  type ChapterId,
  type ContentKey,
  type ImageKey,
  type SectionId,
  type TextKey,
} from "./registry";
