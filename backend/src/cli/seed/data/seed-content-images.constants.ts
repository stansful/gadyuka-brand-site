import { SeedMediaKey } from './seed-media-key.enum';

/**
 * The seed image of every landing image key (content_images; the keys are SiteTextRegistry's — a unit
 * test keeps both key sets equal, as the frontend's `Record<ImageKey, SeedMediaKey>` did).
 */
export const SEED_CONTENT_IMAGES: Readonly<Record<string, SeedMediaKey>> = {
  'about.image': SeedMediaKey.HOODIE_BLACK_BACK,
  'tailoring.image': SeedMediaKey.LEKALA_RACK,
};
