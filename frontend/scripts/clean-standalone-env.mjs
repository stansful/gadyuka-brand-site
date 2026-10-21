// Runs after `npm run build` (npm "postbuild"): Next copies .env* files into
// .next/standalone, which would leave a real secret (INTERNAL_API_KEY) in the build output —
// and in any image built from it.
import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

// The standalone output mirrors the repository (next.config.ts: outputFileTracingRoot = repo root):
// the app and its .env copies are in .next/standalone/frontend/.
const standalone = path.join(process.cwd(), '.next', 'standalone');
let removed = 0;
for (const dir of [standalone, path.join(standalone, 'frontend')]) {
  try {
    for (const name of readdirSync(dir)) {
      if (name === '.env' || name.startsWith('.env.')) {
        rmSync(path.join(dir, name), { force: true });
        removed += 1;
      }
    }
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
}
if (removed > 0) console.log(`[postbuild] removed ${removed} .env file(s) from .next/standalone`);
