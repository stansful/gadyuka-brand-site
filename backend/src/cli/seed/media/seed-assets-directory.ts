import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Location of backend/assets (the seed image sources). Found by walking up from this file, so it works
 * from src (ts), dist / .build (compiled) and inside the image, wherever the process was started.
 */
export class SeedAssetsDirectory {
  private static readonly FOLDER = 'assets';
  /** A folder every assets directory has (the brand photos). */
  private static readonly MARKER = 'photos';

  static locate(start: string = __dirname): string {
    for (let directory = start; ; directory = dirname(directory)) {
      const candidate = join(directory, SeedAssetsDirectory.FOLDER);
      if (existsSync(join(candidate, SeedAssetsDirectory.MARKER))) {
        return candidate;
      }
      if (dirname(directory) === directory) {
        throw new Error(`backend/assets not found above ${start}`);
      }
    }
  }
}
