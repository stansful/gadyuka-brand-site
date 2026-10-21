import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Injectable } from '@nestjs/common';

import { SeedAssetsDirectory } from './seed-assets-directory';

/** Reads the seed image sources of backend/assets (read-only; looked up only when an image is needed). */
@Injectable()
export class SeedAssets {
  /** A source by its path relative to backend/assets ("photos/packaging.jpg"). */
  read(source: string): Promise<Buffer> {
    return readFile(join(SeedAssetsDirectory.locate(), source));
  }
}
