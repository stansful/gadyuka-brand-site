// Runs after `npm run build` (npm "postbuild"): Next copies .env* files into
// .next/standalone, which would leave real secrets (Telegram token, DB password) in the
// build output. The Docker build does the same cleanup (Dockerfile, builder stage).
import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), '.next', 'standalone');
let removed = 0;
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
if (removed > 0) console.log(`[postbuild] removed ${removed} .env file(s) from .next/standalone`);
