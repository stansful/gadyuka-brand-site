/**
 * Encoding of the seed images (port of the frontend's prisma/seed/media.ts — NOT the admin upload
 * settings of src/core/media/media.constants.ts: the seed keeps its own, so its uuids stay stable).
 */
export const SEED_MAX_DIMENSION = 2400;
export const SEED_WEBP_QUALITY = 84;
export const SEED_WEBP_EFFORT = 5;

/**
 * The encoding settings are part of the content hash: changing them yields new uuids (new URLs).
 * "rotate" = auto-orientation by EXIF (sharp's rotate() without an angle, autoOrient()).
 */
export const SEED_ENCODING_SIGNATURE = `webp:q${SEED_WEBP_QUALITY}:e${SEED_WEBP_EFFORT}:max${SEED_MAX_DIMENSION}:rotate:v1`;
