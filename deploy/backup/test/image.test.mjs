import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const image = `gadyuka-backup-test:${process.pid}`;

function docker(args, options = {}) {
  return execFileSync('docker', args, { encoding: 'utf8', timeout: 300_000, ...options });
}

async function executable(file, content) {
  await writeFile(file, content, { mode: 0o755 });
}

test('backup image schedules and completes a split backup with real archive tools', async t => {
  t.after(() => {
    try {
      docker(['image', 'rm', '-f', image]);
    } catch {
      // The failed RED build has no image to remove.
    }
  });
  docker(['build', '--quiet', '--tag', image, '--file', 'deploy/backup/Dockerfile', '.'], {
    cwd: repository,
  });

  const tools = docker([
    'run',
    '--rm',
    '--entrypoint',
    '/bin/sh',
    image,
    '-c',
    'for tool in pg_dump mc curl jq flock crond split tar; do command -v "$tool" || exit 1; done; pg_dump --version; mc --version',
  ]);
  assert.match(tools, /PostgreSQL\) 18\./);

  const manual = docker(['run', '--rm', image, '/bin/sh', '-c', 'printf manual-ok']);
  assert.equal(manual, 'manual-ok');

  const directory = await mkdtemp(path.join(tmpdir(), 'gadyuka-backup-image-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bin = path.join(directory, 'bin');
  const backups = path.join(directory, 'backups');
  const captured = path.join(directory, 'captured');
  await Promise.all([mkdir(bin), mkdir(backups), mkdir(captured)]);
  const fakeCrond = path.join(bin, 'crond');
  await executable(fakeCrond, '#!/bin/sh\nprintf "TZ=%s\\n" "$TZ"\ncat /etc/crontabs/root\n');
  const schedule = docker([
    'run',
    '--rm',
    '--volume',
    `${fakeCrond}:/usr/local/bin/crond:ro`,
    '--env',
    'BACKUP_SCHEDULE=17 4 * * *',
    '--env',
    'BACKUP_TIMEZONE=Europe/Moscow',
    image,
  ]);
  assert.match(schedule, /TZ=Europe\/Moscow/);
  assert.match(schedule, /^17 4 \* \* \* \/opt\/gadyuka-backup\/backup-now\.sh/m);

  await executable(
    path.join(bin, 'pg_dump'),
    "#!/bin/sh\nprintf 'image database dump fixture'\n",
  );
  await executable(
    path.join(bin, 'mc'),
    `#!/bin/sh
if [ "$1" = mirror ]; then
  for destination do :; done
  mkdir -p "$destination"
  printf 'image media fixture' > "$destination/photo.jpg"
fi
`,
  );
  await executable(
    path.join(bin, 'curl'),
    `#!/bin/sh
output=
document=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output) output=$2; shift 2 ;;
    --form)
      case "$2" in document=@*) document=\${2#document=@} ;; esac
      shift 2
      ;;
    --form-string|--write-out) shift 2 ;;
    *) shift ;;
  esac
done
cp "$document" "/captured/$(basename "$document")"
printf '%s' '{"ok":true,"result":{"message_id":1}}' > "$output"
printf '200'
`,
  );
  const environment = {
    PATH: `/fixture/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
    BACKUP_DIR: '/backups',
    BACKUP_CHUNK_BYTES: '96',
    POSTGRES_HOST: 'postgres',
    POSTGRES_PORT: '5432',
    POSTGRES_NAME: 'gadyuka',
    POSTGRES_USER: 'gadyuka',
    POSTGRES_PASS: 'fake-database-password',
    MINIO_ROOT_USER: 'fake-minio-root',
    MINIO_ROOT_PASSWORD: 'fake-minio-password',
    S3_BUCKET: 'gadyuka-media',
    TELEGRAM_BOT_TOKEN: '123456:FAKE_TOKEN',
    TELEGRAM_OWNER_ID: '424242',
    TELEGRAM_DRY_RUN: '0',
    TELEGRAM_API_URL: 'https://telegram.test',
  };
  const args = [
    'run',
    '--rm',
    '--volume',
    `${bin}:/fixture/bin:ro`,
    '--volume',
    `${backups}:/backups`,
    '--volume',
    `${captured}:/captured`,
  ];
  for (const [name, value] of Object.entries(environment)) args.push('--env', `${name}=${value}`);
  args.push(image, '/opt/gadyuka-backup/backup-now.sh');
  const backup = docker(args);
  assert.match(backup, /backup delivered and removed from the server/);
  assert.deepEqual(await readdir(path.join(backups, 'pending')), []);

  const parts = (await readdir(captured)).filter(file => !file.endsWith('.sent')).sort();
  assert.ok(parts.length > 1, `expected split parts, got ${parts.join(', ')}`);
  const archive = path.join(directory, 'captured.tar.gz');
  const chunks = await Promise.all(parts.map(part => readFile(path.join(captured, part))));
  await writeFile(archive, Buffer.concat(chunks));
  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' });
  assert.match(entries, /db_.*\.dump/);
  assert.match(entries, /media\/photo\.jpg/);
});
