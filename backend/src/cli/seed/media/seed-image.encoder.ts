import { Injectable } from '@nestjs/common';

import sharp from 'sharp';

import { SEED_MAX_DIMENSION, SEED_WEBP_EFFORT, SEED_WEBP_QUALITY } from './seed-media.constants';

/** A seed image as stored: WebP bytes and their dimensions. */
export interface EncodedSeedImage {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
  readonly size: number;
}

/** Source image → WebP: auto-orient, fit inside 2400×2400 (never upscale), quality 95, effort 5. */
@Injectable()
export class SeedImageEncoder {
  async encode(source: Buffer): Promise<EncodedSeedImage> {
    const { data, info } = await sharp(source)
      .autoOrient()
      .resize({ width: SEED_MAX_DIMENSION, height: SEED_MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: SEED_WEBP_QUALITY, effort: SEED_WEBP_EFFORT })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, size: data.byteLength };
  }
}
