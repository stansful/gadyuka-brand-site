/**
 * Seed images: brand photos and key brandbook slides (sources: SEED_MEDIA_SOURCES). The value is the
 * image's stable seed identity — part of its derived Media.uuid (SeedMediaIdentity) and the key of its alt
 * text (`mediaAlt.<value>` in shared/messages/content/<locale>.json). Never rename a value: the image
 * would get a new uuid (a new URL) on the next SEED_OVERWRITE=1.
 */
export enum SeedMediaKey {
  HOODIE_WHITE_LOGO = 'hoodieWhiteLogo',
  HOODIE_WHITE_HEAD = 'hoodieWhiteHead',
  HOODIE_WHITE_SCALES = 'hoodieWhiteScales',
  HOODIE_BLACK_BACK = 'hoodieBlackBack',
  PACKAGING = 'packaging',
  HANGTAG = 'hangtag',
  LABEL_LOGO = 'labelLogo',
  LABEL_TONGUE = 'labelTongue',
  LEKALA_RACK = 'lekalaRack',
  WORDMARK_ON_BLACK = 'wordmarkOnBlack',
  WORDMARK_PATTERN_RED = 'wordmarkPatternRed',
  STYLE_ELEMENTS = 'styleElements',
  SNAKE_HEAD_CLOSEUP = 'snakeHeadCloseup',
}

/** Every seed image, in the order of the enum (= the upload order). */
export const SEED_MEDIA_KEYS: readonly SeedMediaKey[] = Object.values(SeedMediaKey);
