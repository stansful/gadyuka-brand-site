import { SeedMediaKey } from './seed-media-key.enum';

/**
 * Source file of every seed image, relative to backend/assets (read-only: the seed encodes a WebP copy).
 * `Record<SeedMediaKey, …>`: TypeScript requires a source for every image.
 */
export const SEED_MEDIA_SOURCES: Readonly<Record<SeedMediaKey, string>> = {
  [SeedMediaKey.HOODIE_WHITE_LOGO]: 'photos/hoodie-white-logo.jpg',
  [SeedMediaKey.HOODIE_WHITE_HEAD]: 'photos/hoodie-white-head.jpg',
  [SeedMediaKey.HOODIE_WHITE_SCALES]: 'photos/hoodie-white-scales.jpg',
  [SeedMediaKey.HOODIE_BLACK_BACK]: 'photos/hoodie-black-back.jpg',
  [SeedMediaKey.PACKAGING]: 'photos/packaging.jpg',
  [SeedMediaKey.HANGTAG]: 'photos/hangtag.jpg',
  [SeedMediaKey.LABEL_LOGO]: 'photos/label-logo.jpg',
  [SeedMediaKey.LABEL_TONGUE]: 'photos/label-tongue.jpg',
  [SeedMediaKey.LEKALA_RACK]: 'photos/lekala-rack.jpg',
  [SeedMediaKey.WORDMARK_ON_BLACK]: 'brandbook/01-wordmark-on-black.jpg',
  [SeedMediaKey.WORDMARK_PATTERN_RED]: 'brandbook/06-wordmark-pattern-red.jpg',
  [SeedMediaKey.STYLE_ELEMENTS]: 'brandbook/07-style-elements.jpg',
  [SeedMediaKey.SNAKE_HEAD_CLOSEUP]: 'brandbook/14-snake-head-closeup.jpg',
};
