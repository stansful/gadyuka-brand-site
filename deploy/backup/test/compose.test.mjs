import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('compose runs the backup container with only the required access', () => {
  const output = execFileSync('docker', ['compose', 'config', '--format', 'json'], {
    cwd: repository,
    encoding: 'utf8',
  });
  const config = JSON.parse(output);
  const backup = config.services.backup;
  assert.ok(backup, 'backup service is missing');
  assert.equal(backup.build.dockerfile, 'deploy/backup/Dockerfile');
  assert.deepEqual(Object.keys(backup.networks).sort(), ['data', 'edge']);
  assert.deepEqual(Object.keys(backup.environment).sort(), [
    'BACKUP_SCHEDULE',
    'BACKUP_TIMEZONE',
    'MINIO_ROOT_PASSWORD',
    'MINIO_ROOT_USER',
    'POSTGRES_HOST',
    'POSTGRES_NAME',
    'POSTGRES_PASS',
    'POSTGRES_PORT',
    'POSTGRES_USER',
    'S3_BUCKET',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_DRY_RUN',
    'TELEGRAM_OWNER_ID',
  ]);
  assert.equal(backup.environment.BACKUP_SCHEDULE, '30 3 * * *');
  assert.equal(backup.environment.BACKUP_TIMEZONE, 'Europe/Moscow');
  assert.ok(backup.volumes.some(volume => volume.type === 'bind' && volume.target === '/backups'));
  assert.ok(backup.volumes.every(volume => !String(volume.source).includes('docker.sock')));
  assert.equal(backup.init, true);
  assert.equal(backup.restart, 'unless-stopped');
  assert.deepEqual(backup.cap_drop, ['ALL']);
  assert.ok(backup.security_opt.includes('no-new-privileges:true'));
  assert.equal(backup.depends_on.postgres.condition, 'service_healthy');
  assert.equal(backup.depends_on['minio-init'].condition, 'service_completed_successfully');
});

test('host setup creates a private backup directory', () => {
  const result = execFileSync(
    'bash',
    ['-c', '. deploy/lib.sh; printf "%s" " $VOLUME_SPECS "'],
    { cwd: repository, encoding: 'utf8' },
  );
  assert.ok(result.includes(' backups:0:0:700 '));
});

test('backup schedule has safe defaults and survives the installer sudo re-exec', () => {
  const result = execFileSync(
    'bash',
    [
      '-c',
      'set -a; . ./.env.example; set +a; . ./deploy/lib.sh; printf "%s\\n%s\\n%s" "${BACKUP_SCHEDULE:-missing}" "${BACKUP_TIMEZONE:-missing}" " $PRESERVED_VARS "',
    ],
    { cwd: repository, encoding: 'utf8' },
  );
  const [schedule, timezone, preserved] = result.split('\n');
  assert.equal(schedule, '30 3 * * *');
  assert.equal(timezone, 'Europe/Moscow');
  assert.ok(preserved.includes(' BACKUP_SCHEDULE '));
  assert.ok(preserved.includes(' BACKUP_TIMEZONE '));
});
