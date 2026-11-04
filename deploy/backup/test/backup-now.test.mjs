import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const script = path.join(repository, 'deploy/backup/backup-now.sh');
const fakeSplit = path.join(repository, 'deploy/backup/test/fake-split.mjs');

async function executable(file, content) {
  await writeFile(file, content, { mode: 0o755 });
}

async function fixture(t, overrides = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'gadyuka-backup-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bin = path.join(directory, 'bin');
  const backupDir = path.join(directory, 'backups');
  const captureDir = path.join(directory, 'captured');
  const commandLog = path.join(directory, 'commands.log');
  const curlLog = path.join(directory, 'curl.log');
  const curlCount = path.join(directory, 'curl-count');
  await Promise.all([mkdir(bin), mkdir(backupDir), mkdir(captureDir)]);

  await executable(
    path.join(bin, 'date'),
    `#!/bin/sh
if [ -n "$FAKE_STAMP" ]; then
  case "$*" in
    *%Y-%m-%d_%H%M%S*) printf '%s' "$FAKE_STAMP" ;;
    *) printf '2026-11-05T00:00:00Z' ;;
  esac
else
  exec /bin/date "$@"
fi
`,
  );
  await executable(
    path.join(bin, 'pg_dump'),
    `#!/bin/sh\nprintf 'pg_dump\\n' >> "$COMMAND_LOG"\nprintf 'postgresql custom dump fixture'\n`,
  );
  await executable(
    path.join(bin, 'mc'),
    `#!/bin/sh
if [ "$1" = mirror ]; then
  for destination do :; done
  mkdir -p "$destination"
  printf 'media fixture' > "$destination/photo.jpg"
fi
`,
  );
  await executable(
    path.join(bin, 'flock'),
    `#!/bin/sh\n[ "$FLOCK_LOCKED" = 1 ] && exit 1\nexit 0\n`,
  );
  await executable(
    path.join(bin, 'jq'),
    `#!/bin/sh
for response do :; done
node -e 'const fs = require("node:fs"); const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.exit(body.ok === true ? 0 : 1)' "$response"
`,
  );
  await executable(
    path.join(bin, 'split'),
    `#!/bin/sh\n[ "$SPLIT_FAIL" = 1 ] && exit 1\nnode "${fakeSplit}" "$@"\n`,
  );
  await executable(
    path.join(bin, 'curl'),
    `#!/bin/sh
output=
document=
caption=
url=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output) output=$2; shift 2 ;;
    --form)
      case "$2" in document=@*) document=\${2#document=@} ;; esac
      shift 2
      ;;
    --form-string)
      case "$2" in caption=*) caption=\${2#caption=} ;; esac
      shift 2
      ;;
    --write-out) shift 2 ;;
    *) url=$1; shift ;;
  esac
done
[ -n "$document" ] || exit 64
basename "$document" >> "$CURL_LOG"
printf '%s|%s\n' "$(basename "$document")" "$caption" >> "$CURL_LOG.captions"
cp "$document" "$CAPTURE_DIR/$(basename "$document")"
count=0
[ ! -f "$CURL_COUNT" ] || count=$(cat "$CURL_COUNT")
count=$((count + 1))
printf '%s' "$count" > "$CURL_COUNT"
result=$(printf '%s' "$CURL_RESULTS" | cut -d, -f "$count")
[ -n "$result" ] || result=ok
case "$result" in
  fail) printf '%s' '{"ok":false,"error_code":400,"description":"rejected"}' > "$output"; code=400 ;;
  http500) printf '%s' '{"ok":false,"error_code":500,"description":"temporary"}' > "$output"; code=500 ;;
  *) printf '%s' '{"ok":true,"result":{"message_id":1}}' > "$output"; code=200 ;;
esac
printf '%s' "$code"
`,
  );

  const env = {
    ...process.env,
    PATH: `${bin}:${path.dirname(process.execPath)}:/usr/bin:/bin`,
    BACKUP_DIR: backupDir,
    BACKUP_CHUNK_BYTES: '1048576',
    CAPTURE_DIR: captureDir,
    COMMAND_LOG: commandLog,
    CURL_LOG: curlLog,
    CURL_COUNT: curlCount,
    CURL_RESULTS: 'ok',
    FLOCK_LOCKED: '0',
    POSTGRES_HOST: 'postgres',
    POSTGRES_PORT: '5432',
    POSTGRES_NAME: 'gadyuka',
    POSTGRES_USER: 'gadyuka',
    POSTGRES_PASS: 'database-password',
    MINIO_ROOT_USER: 'minio-root',
    MINIO_ROOT_PASSWORD: 'minio-password',
    S3_BUCKET: 'gadyuka-media',
    TELEGRAM_BOT_TOKEN: '123456:FAKE_TOKEN',
    TELEGRAM_OWNER_ID: '424242',
    TELEGRAM_DRY_RUN: '0',
    TELEGRAM_API_URL: 'https://telegram.test',
    TZ: 'UTC',
    ...overrides,
  };
  return { directory, backupDir, captureDir, commandLog, curlLog, env };
}

function run(environment) {
  return spawnSync('bash', [script], { env: environment, encoding: 'utf8' });
}

async function pendingDirectories(backupDir) {
  try {
    return (await readdir(path.join(backupDir, 'pending'), { withFileTypes: true }))
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function capturedParts(captureDir) {
  return (await readdir(captureDir)).sort();
}

async function exists(file) {
  try {
    await readFile(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

const nextTimestamp = () => new Promise(resolve => setTimeout(resolve, 1100));

test('sends a restorable database and media archive, then removes the server copy', async t => {
  const { backupDir, captureDir, env } = await fixture(t);
  const result = run(env);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await pendingDirectories(backupDir), []);
  const [archive] = await capturedParts(captureDir);
  assert.match(archive, /^gadyuka-backup_\d{4}-\d{2}-\d{2}_\d{6}\.tar\.gz$/);
  const archivePath = path.join(captureDir, archive);
  const entries = execFileSync('tar', ['-tzf', archivePath], { encoding: 'utf8' }).trim().split('\n');
  const dump = entries.find(entry => /^db_.*\.dump$/.test(entry));
  assert.ok(dump, entries.join('\n'));
  assert.ok(entries.includes('media/photo.jpg'));
  assert.equal(execFileSync('tar', ['-xOzf', archivePath, dump], { encoding: 'utf8' }), 'postgresql custom dump fixture');
  assert.equal(
    execFileSync('tar', ['-xOzf', archivePath, 'media/photo.jpg'], { encoding: 'utf8' }),
    'media fixture',
  );
});

test('keeps the archive when Telegram returns ok false', async t => {
  const { backupDir, env } = await fixture(t, { CURL_RESULTS: 'fail' });
  const result = run(env);
  assert.notEqual(result.status, 127);
  assert.notEqual(result.status, 0);
  const pending = await pendingDirectories(backupDir);
  assert.equal(pending.length, 1);
  const files = await readdir(path.join(backupDir, 'pending', pending[0]));
  assert.ok(files.some(file => file.endsWith('.tar.gz')));
});

test('resumes a multi-part archive without resending confirmed parts', async t => {
  const { backupDir, curlLog, env } = await fixture(t, {
    BACKUP_CHUNK_BYTES: '96',
    CURL_RESULTS: 'ok,fail',
  });
  const firstRun = run(env);
  assert.notEqual(firstRun.status, 127);
  assert.notEqual(firstRun.status, 0);
  const [oldPending] = await pendingDirectories(backupDir);
  const oldPrefix = oldPending.replace(/\.[^.]+$/, '');
  const firstPart = `${oldPrefix}.tar.gz.000`;
  const secondPart = `${oldPrefix}.tar.gz.001`;
  const firstLog = await readFile(curlLog, 'utf8');
  assert.ok(firstLog.includes(firstPart));
  assert.ok(firstLog.includes(secondPart));

  await nextTimestamp();
  env.CURL_RESULTS = 'ok';
  const retry = run(env);
  assert.equal(retry.status, 0, retry.stderr);
  const attempts = (await readFile(curlLog, 'utf8')).trim().split('\n');
  assert.equal(attempts.filter(file => file === firstPart).length, 1);
  assert.equal(attempts.filter(file => file === secondPart).length, 2);
  const captions = (await readFile(`${curlLog}.captions`, 'utf8')).trim().split('\n');
  const secondPartCaptions = captions.filter(line => line.startsWith(`${secondPart}|`));
  assert.equal(secondPartCaptions.length, 2);
  for (const line of secondPartCaptions) {
    assert.ok(line.startsWith(`${secondPart}|ГАДЮКА: бэкап ${oldPending}, файл 2/`), line);
  }
  assert.deepEqual(await pendingDirectories(backupDir), []);
});

test('dry run neither calls Telegram nor removes the archive', async t => {
  const { backupDir, curlLog, env } = await fixture(t, { TELEGRAM_DRY_RUN: '1' });
  const result = run(env);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await exists(curlLog), false);
  assert.equal((await pendingDirectories(backupDir)).length, 1);
});

test('rejects missing Telegram configuration before creating an archive', async t => {
  const { backupDir, commandLog, env } = await fixture(t, { TELEGRAM_BOT_TOKEN: '' });
  const result = run(env);
  assert.notEqual(result.status, 127);
  assert.notEqual(result.status, 0);
  assert.deepEqual(await pendingDirectories(backupDir), []);
  assert.equal(await exists(commandLog), false);
});

test('skips a concurrent run before dumping or sending', async t => {
  const { backupDir, commandLog, curlLog, env } = await fixture(t, { FLOCK_LOCKED: '1' });
  const result = run(env);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await pendingDirectories(backupDir), []);
  assert.equal(await exists(commandLog), false);
  assert.equal(await exists(curlLog), false);
});

test('keeps a completed archive when splitting fails and retries it later', async t => {
  const { backupDir, curlLog, env } = await fixture(t, {
    BACKUP_CHUNK_BYTES: '96',
    SPLIT_FAIL: '1',
  });
  const firstRun = run(env);
  assert.notEqual(firstRun.status, 0);
  const [pending] = await pendingDirectories(backupDir);
  assert.ok(pending, firstRun.stderr);
  const files = await readdir(path.join(backupDir, 'pending', pending));
  assert.ok(files.includes(`${pending}.tar.gz`));
  assert.ok(!files.some(file => file.endsWith('.000')));

  await nextTimestamp();
  env.SPLIT_FAIL = '0';
  const retry = run(env);
  assert.equal(retry.status, 0, retry.stderr);
  assert.deepEqual(await pendingDirectories(backupDir), []);
  const attempts = await readFile(curlLog, 'utf8');
  assert.ok(attempts.includes(`${pending}.tar.gz.000`));
});

test('does not delete an existing pending archive on a timestamp collision', async t => {
  const { backupDir, env } = await fixture(t, {
    CURL_RESULTS: 'fail',
    FAKE_STAMP: '2026-11-05_030000',
  });
  assert.notEqual(run(env).status, 0);
  const [pending] = await pendingDirectories(backupDir);
  assert.equal(pending, 'gadyuka-backup_2026-11-05_030000');

  env.CURL_RESULTS = 'ok';
  assert.notEqual(run(env).status, 0);
  assert.deepEqual(await pendingDirectories(backupDir), [pending]);
  const files = await readdir(path.join(backupDir, 'pending', pending));
  assert.ok(files.includes(`${pending}.tar.gz`));
});
