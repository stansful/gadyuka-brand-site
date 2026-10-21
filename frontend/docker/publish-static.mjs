// Runs at container start (docker/entrypoint.sh, before `node server.js`): publishes the build's static
// files into STATIC_PUBLISH_DIR — a volume the reverse proxy serves /_next/static/* and /brand/* from,
// precompressed siblings included (docs/COMPRESSION.md):
//
//   .next/static/**   → <dir>/_next/static/**
//   public/**         → <dir>/**
//
// - Idempotent: a file whose bytes are already there is left alone (stable mtime → stable ETag); a new or
//   changed one is written to a temporary name and renamed, so the proxy never reads half a file.
//   Precompressed siblings (.br/.zst/.gz) go first, and a sibling the build no longer has is removed
//   (a stale one would be served for the new content).
// - Previous builds stay: pages already open in a browser keep loading their old chunks. A build's file
//   list is kept in <dir>/.publish/manifests/<BUILD_ID>.json; files only an old build used are deleted
//   STATIC_RETAIN_DAYS (default 7) days after that build was replaced.
// Node built-ins only; exit code 1 on failure (the entrypoint logs it and starts the server anyway — the
// proxy then forwards these paths to Next).
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, chmod, mkdir, readFile, readdir, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEST = process.env.STATIC_PUBLISH_DIR ?? '';
const RETAIN_DAYS = Number(process.env.STATIC_RETAIN_DAYS ?? '7');
const DAY_MS = 24 * 60 * 60 * 1000;
const APP_DIR = process.cwd();
const SOURCES = [
  { from: path.join(APP_DIR, '.next', 'static'), to: path.join('_next', 'static') },
  { from: path.join(APP_DIR, 'public'), to: '' },
];
const SIBLING_EXTS = ['.br', '.zst', '.gz'];
const STATE_DIR = '.publish';
const FILE_MODE = 0o644;
const DIR_MODE = 0o755;

const log = message => process.stdout.write(`[publish-static] ${message}\n`);

async function listFiles(root, prefix = '') {
  const entries = await readdir(path.join(root, prefix), { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const files = [];
  for (const entry of entries) {
    const rel = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, rel)));
    else if (entry.isFile()) files.push(rel);
  }
  return files;
}

const isSibling = rel => SIBLING_EXTS.includes(path.extname(rel));

async function sameContent(source, target) {
  const [a, b] = await Promise.all([stat(source), stat(target).catch(() => null)]);
  if (b === null || a.size !== b.size) return false;
  const [x, y] = await Promise.all([readFile(source), readFile(target)]);
  return x.equals(y);
}

async function publishFile(source, target) {
  if (await sameContent(source, target)) return false;
  await mkdir(path.dirname(target), { recursive: true, mode: DIR_MODE });
  const temporary = `${target}.tmp-${process.pid}-${createHash('sha1').update(target).digest('hex').slice(0, 8)}`;
  await writeFile(temporary, await readFile(source), { mode: FILE_MODE });
  await chmod(temporary, FILE_MODE);
  await rename(temporary, target);
  return true;
}

async function exists(file) {
  return stat(file).then(
    () => true,
    () => false,
  );
}

/** Copies every source file (siblings first); returns the published relative paths and counters. */
async function publishSources() {
  const published = [];
  let copied = 0;
  let removedSiblings = 0;
  for (const source of SOURCES) {
    const files = (await listFiles(source.from)).sort((a, b) => Number(isSibling(b)) - Number(isSibling(a)));
    for (const rel of files) {
      const target = path.join(DEST, source.to, rel);
      if (await publishFile(path.join(source.from, rel), target)) copied += 1;
      published.push(path.join(source.to, rel));
    }
    for (const rel of files.filter(file => !isSibling(file))) {
      for (const ext of SIBLING_EXTS) {
        const stale = path.join(DEST, source.to, rel + ext);
        if (!(await exists(path.join(source.from, rel + ext))) && (await exists(stale))) {
          await rm(stale, { force: true });
          removedSiblings += 1;
        }
      }
    }
  }
  return { published: published.sort(), copied, removedSiblings };
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true, mode: DIR_MODE });
  const temporary = `${file}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: FILE_MODE });
  await rename(temporary, file);
}

const manifestPath = buildId => path.join(DEST, STATE_DIR, 'manifests', `${buildId}.json`);

/** Records the current build, marks the previous one as replaced, deletes what only expired builds used. */
async function updateState(buildId, published, nowMs) {
  const statePath = path.join(DEST, STATE_DIR, 'state.json');
  const state = await readJson(statePath, { current: null, superseded: {} });
  if (state.current && state.current !== buildId && !state.superseded[state.current]) {
    state.superseded[state.current] = new Date(nowMs).toISOString();
  }
  delete state.superseded[buildId];
  state.current = buildId;
  await writeJson(manifestPath(buildId), published);

  const expired = Object.entries(state.superseded)
    .filter(([, at]) => nowMs - Date.parse(at) > RETAIN_DAYS * DAY_MS)
    .map(([id]) => id);
  const keep = new Set(published);
  for (const id of Object.keys(state.superseded).filter(id => !expired.includes(id))) {
    for (const rel of await readJson(manifestPath(id), [])) keep.add(rel);
  }
  let pruned = 0;
  for (const id of expired) {
    for (const rel of await readJson(manifestPath(id), [])) {
      if (keep.has(rel)) continue;
      await rm(path.join(DEST, rel), { force: true });
      pruned += 1;
    }
    await rm(manifestPath(id), { force: true });
    delete state.superseded[id];
  }
  await writeJson(statePath, state);
  if (pruned > 0) await removeEmptyDirectories(path.join(DEST, '_next', 'static'));
  return { pruned, expired: expired.length, retained: Object.keys(state.superseded).length };
}

async function removeEmptyDirectories(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory()) await removeEmptyDirectories(path.join(directory, entry.name));
  }
  await rmdir(directory).catch(() => undefined);
}

async function main() {
  if (DEST === '') throw new Error('STATIC_PUBLISH_DIR is not set');
  if (!Number.isFinite(RETAIN_DAYS) || RETAIN_DAYS < 0) throw new Error('STATIC_RETAIN_DAYS must be a number ≥ 0');
  await access(DEST, constants.W_OK);
  const buildId = (await readFile(path.join(APP_DIR, '.next', 'BUILD_ID'), 'utf8')).trim();
  const { published, copied, removedSiblings } = await publishSources();
  const { pruned, expired, retained } = await updateState(buildId, published, Date.now());
  log(
    `build ${buildId}: ${published.length} files in ${DEST} (${copied} written, ${removedSiblings} stale siblings removed); ` +
      `previous builds kept: ${retained}, expired: ${expired} (${pruned} files deleted)`,
  );
}

main().catch(error => {
  process.stderr.write(`[publish-static] failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
