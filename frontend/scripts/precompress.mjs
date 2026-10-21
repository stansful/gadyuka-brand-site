// Runs after `npm run build` (npm "postbuild", after clean-standalone-env.mjs): writes precompressed
// siblings — <file>.br (brotli q11), <file>.gz (gzip -9) and, when this Node has it, <file>.zst
// (zstd -19) — next to every compressible build asset, so the reverse proxy can serve them from disk
// instead of compressing the same immutable file on every request (docs/COMPRESSION.md).
//
//   node scripts/precompress.mjs            → .next/static, public (+ their copies in .next/standalone)
//   node scripts/precompress.mjs <dir> …    → only the given directories
//
// Idempotent: a sibling at least as new as its source that still decompresses to it is kept; a
// sibling whose source is gone, or which would not be smaller than the source, is removed. Files under MIN_BYTES are left alone
// (the proxy sends them as they are). Node built-ins only.
import { existsSync } from 'node:fs';
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

/** Text formats worth compressing; already-compressed ones (woff2, png, jpg, webp, avif, …) are not listed. */
const COMPRESSIBLE = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.svg',
  '.json',
  '.txt',
  '.xml',
  '.webmanifest',
  '.html',
  '.map',
]);

const MIN_BYTES = 1024;

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);
const zstd = typeof zlib.zstdCompress === 'function' ? promisify(zlib.zstdCompress) : null;

/** @type {ReadonlyArray<{ ext: string; compress: (data: Buffer) => Promise<Buffer>; decompress: (data: Buffer) => Promise<Buffer> }>} */
const ENCODINGS = [
  {
    ext: '.br',
    compress: data =>
      brotli(data, {
        params: {
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
          [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
          [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length,
        },
      }),
    decompress: promisify(zlib.brotliDecompress),
  },
  {
    ext: '.gz',
    compress: data => gzip(data, { level: zlib.constants.Z_BEST_COMPRESSION, memLevel: 9 }),
    decompress: promisify(zlib.gunzip),
  },
  ...(zstd
    ? [
        {
          ext: '.zst',
          // Level 19 keeps the window ≤ 8 MB — the most an HTTP `Content-Encoding: zstd` decoder must accept.
          compress: data => zstd(data, { params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 } }),
          decompress: promisify(zlib.zstdDecompress),
        },
      ]
    : []),
];
const SIBLING_EXTS = new Set(ENCODINGS.map(encoding => encoding.ext).concat(['.br', '.gz', '.zst']));

const cwd = process.cwd();
const DEFAULT_ROOTS = [
  '.next/static',
  'public',
  // Present only when the static files were copied into the standalone output. The standalone app
  // sits in frontend/ (next.config.ts traces from the repository root to include ../shared).
  '.next/standalone/frontend/.next/static',
  '.next/standalone/frontend/public',
];

/** @param {string} dir @returns {AsyncGenerator<string>} */
async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

/** True when `file` is a precompressed sibling of a compressible file (x.js.br …). */
function isSibling(file) {
  const ext = path.extname(file);
  return SIBLING_EXTS.has(ext) && COMPRESSIBLE.has(path.extname(file.slice(0, -ext.length)));
}

/** mtime of a file, or null when it does not exist. */
async function mtimeOf(file) {
  try {
    return (await stat(file)).mtimeMs;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

/** Runs `tasks` with at most `limit` in flight (zlib's async work runs on the libuv thread pool). */
async function runLimited(tasks, limit) {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const task = tasks[next];
      next += 1;
      await task();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

function kib(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

async function precompressRoot(root) {
  const totals = { files: 0, small: 0, raw: 0, written: 0, kept: 0, removed: 0, sizes: new Map() };
  for (const encoding of ENCODINGS) totals.sizes.set(encoding.ext, 0);
  const tasks = [];
  for await (const file of walk(root)) {
    if (isSibling(file)) {
      const source = file.slice(0, -path.extname(file).length);
      if (!existsSync(source)) {
        await rm(file, { force: true });
        totals.removed += 1;
      }
      continue;
    }
    if (!COMPRESSIBLE.has(path.extname(file).toLowerCase())) continue;
    tasks.push(async () => {
      const info = await stat(file);
      if (info.size < MIN_BYTES) {
        totals.small += 1;
        for (const encoding of ENCODINGS) {
          if ((await mtimeOf(file + encoding.ext)) !== null) {
            await rm(file + encoding.ext, { force: true });
            totals.removed += 1;
          }
        }
        return;
      }
      totals.files += 1;
      totals.raw += info.size;
      let data = null;
      for (const encoding of ENCODINGS) {
        const target = file + encoding.ext;
        const targetTime = await mtimeOf(target);
        if (targetTime !== null && targetTime >= info.mtimeMs) {
          // Newer is not enough (cp -p / rsync -a / tar keep old mtimes): keep it only when it still
          // decompresses to the source — a stale copy would be served under the new content hash.
          data ??= await readFile(file);
          const packed = await readFile(target);
          const unpacked = await encoding.decompress(packed).catch(() => null);
          if (unpacked !== null && unpacked.equals(data)) {
            totals.kept += 1;
            totals.sizes.set(encoding.ext, totals.sizes.get(encoding.ext) + packed.length);
            continue;
          }
        }
        data ??= await readFile(file);
        const packed = await encoding.compress(data);
        if (packed.length >= data.length) {
          // Not worth a sibling: the proxy sends the file as it is.
          if (targetTime !== null) {
            await rm(target, { force: true });
            totals.removed += 1;
          }
          totals.sizes.set(encoding.ext, totals.sizes.get(encoding.ext) + data.length);
          continue;
        }
        await writeFile(target, packed);
        totals.written += 1;
        totals.sizes.set(encoding.ext, totals.sizes.get(encoding.ext) + packed.length);
      }
    });
  }
  await runLimited(tasks, Math.max(2, os.availableParallelism()));
  return totals;
}

const roots = (process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_ROOTS)
  .map(root => path.resolve(cwd, root))
  .filter(root => existsSync(root));

const started = performance.now();
for (const root of roots) {
  const totals = await precompressRoot(root);
  const sizes = [...totals.sizes.entries()]
    .map(
      ([ext, size]) =>
        `${ext.slice(1)} ${kib(size)}${totals.raw > 0 ? ` (${Math.round((size / totals.raw) * 100)}%)` : ''}`,
    )
    .join(' · ');
  console.log(
    `[precompress] ${path.relative(cwd, root) || '.'}: ${totals.files} file(s), raw ${kib(totals.raw)} → ${sizes}; ` +
      `${totals.written} written, ${totals.kept} up to date, ${totals.removed} removed, ${totals.small} under ${MIN_BYTES} B skipped`,
  );
}
if (!zstd) console.log('[precompress] this Node has no zlib zstd — .zst siblings skipped');
console.log(`[precompress] done in ${((performance.now() - started) / 1000).toFixed(1)} s`);
