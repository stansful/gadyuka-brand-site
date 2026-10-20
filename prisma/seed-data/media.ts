import type { ImageKey } from '../../src/lib/content/registry';
import type { LocalizedText } from '../../src/lib/i18n-text';

import { localized, type SeedCopy } from './copy';

/**
 * Seed media: brand photos + key brandbook slides. prisma/seed/media.ts encodes each source to
 * WebP (≤2400 px) and uploads it to S3 (admin/<ownerId>/<uuid>/image.webp); the key of this
 * record is the image's stable seed identity. Alt texts: messages/content/<locale>.json
 * `mediaAlt.<key>` — the `satisfies` below makes TypeScript require one for every image (and no
 * alt without an image).
 */
export const SEED_MEDIA = {
  hoodieWhiteLogo: { source: 'assets/photos/hoodie-white-logo.jpg' },
  hoodieWhiteHead: { source: 'assets/photos/hoodie-white-head.jpg' },
  hoodieWhiteScales: { source: 'assets/photos/hoodie-white-scales.jpg' },
  hoodieBlackBack: { source: 'assets/photos/hoodie-black-back.jpg' },
  packaging: { source: 'assets/photos/packaging.jpg' },
  hangtag: { source: 'assets/photos/hangtag.jpg' },
  labelLogo: { source: 'assets/photos/label-logo.jpg' },
  labelTongue: { source: 'assets/photos/label-tongue.jpg' },
  lekalaRack: { source: 'assets/photos/lekala-rack.jpg' },
  wordmarkOnBlack: { source: 'assets/brandbook/01-wordmark-on-black.jpg' },
  wordmarkPatternRed: { source: 'assets/brandbook/06-wordmark-pattern-red.jpg' },
  styleElements: { source: 'assets/brandbook/07-style-elements.jpg' },
  snakeHeadCloseup: { source: 'assets/brandbook/14-snake-head-closeup.jpg' },
} as const satisfies Record<keyof SeedCopy['mediaAlt'], { source: string }>;

export type SeedMediaKey = keyof typeof SEED_MEDIA;

export const SEED_MEDIA_KEYS: readonly SeedMediaKey[] = Object.keys(SEED_MEDIA).filter(isSeedMediaKey);

export function isSeedMediaKey(value: string): value is SeedMediaKey {
  return Object.prototype.hasOwnProperty.call(SEED_MEDIA, value);
}

/** Alt text of a seed image in every locale. */
export function seedMediaAlt(key: SeedMediaKey): LocalizedText {
  return localized(copy => copy.mediaAlt[key]);
}

/** Landing images (ContentImage rows) → their seed image. */
export const SEED_CONTENT_IMAGES: Readonly<Record<ImageKey, SeedMediaKey>> = {
  'about.image': 'hoodieBlackBack',
  'tailoring.image': 'lekalaRack',
};
