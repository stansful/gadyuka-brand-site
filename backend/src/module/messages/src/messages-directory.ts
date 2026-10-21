import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Location of shared/messages (repository root). Found by walking up from this file, so it works
 * from src (ts), dist (compiled) and inside the image, wherever the process was started.
 */
export class MessagesDirectory {
  private static readonly RELATIVE_PATH = join('shared', 'messages');
  private static readonly MARKER_FILE = 'ru.json';

  static locate(start: string = __dirname): string {
    for (let directory = start; ; directory = dirname(directory)) {
      const candidate = join(directory, MessagesDirectory.RELATIVE_PATH);
      if (existsSync(join(candidate, MessagesDirectory.MARKER_FILE))) {
        return candidate;
      }
      if (dirname(directory) === directory) {
        throw new Error(`shared/messages not found above ${start}`);
      }
    }
  }
}
