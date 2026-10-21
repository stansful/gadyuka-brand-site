/**
 * What a run seeds besides the admin, the site messages and the content image rows:
 * - FULL: a first run (no site settings row yet) or SEED_OVERWRITE=1 — every seed image and every demo
 *   entity;
 * - NEW_IMAGE_KEYS: a seeded database — only the images of content image keys without a row (new keys
 *   after a code update); the demo entities belong to the admin and are not touched.
 */
export enum SeedScope {
  FULL = 'FULL',
  NEW_IMAGE_KEYS = 'NEW_IMAGE_KEYS',
}
