import { ok, strictEqual } from 'node:assert';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { setTimeout } from 'node:timers/promises';

import { ConfigService } from '~config';
import { TestEnvironment } from '~test/test-environment';

import { AppLogger } from './app-logger';

const FLUSH_POLL_MS = 20;
const FLUSH_ATTEMPTS = 50;

class LogFile {
  constructor(private readonly path: string) {}

  /** The lines once the first one is on disk (the stream writes asynchronously). */
  async lines(): Promise<string[]> {
    for (let attempt = 0; attempt < FLUSH_ATTEMPTS; attempt += 1) {
      if (existsSync(this.path) && readFileSync(this.path, 'utf8').includes('\n')) {
        break;
      }
      await setTimeout(FLUSH_POLL_MS);
    }
    return readFileSync(this.path, 'utf8').trim().split('\n');
  }
}

describe('AppLogger (LOG_DIR file)', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gadyuka-app-logger-'));
  after(() => rmSync(directory, { recursive: true, force: true }));

  it('appends JSON lines to <LOG_DIR>/backend.log and keeps lines logged after shutdown out of it', async () => {
    const logger = new AppLogger(new ConfigService(TestEnvironment.valid({ LOG_DIR: directory })));

    logger.log('before shutdown', 'AppLoggerTest');
    logger.onApplicationShutdown();
    // Before the fix this write crashed the process (ERR_STREAM_WRITE_AFTER_END, unhandled 'error').
    logger.error('after shutdown', undefined, 'AppLoggerTest');
    await setTimeout(FLUSH_POLL_MS);

    const lines = await new LogFile(join(directory, AppLogger.FILE_NAME)).lines();
    strictEqual(lines.length, 1);
    ok(lines[0]?.includes('before shutdown'));
  });

  it('keeps running when the log file cannot be opened (the lines still go to stdout)', async () => {
    const blocked = join(directory, 'blocked');
    // A directory where the file should be: opening it fails (EISDIR), like a LOG_DIR owned by root.
    mkdirSync(join(blocked, AppLogger.FILE_NAME), { recursive: true });
    const logger = new AppLogger(new ConfigService(TestEnvironment.valid({ LOG_DIR: blocked })));

    // Before the fix the failed open crashed the process (unhandled 'error' event of the stream).
    logger.log('first', 'AppLoggerTest');
    await setTimeout(FLUSH_POLL_MS * FLUSH_ATTEMPTS);
    logger.log('second', 'AppLoggerTest');
    logger.onApplicationShutdown();

    ok(statSync(join(blocked, AppLogger.FILE_NAME)).isDirectory());
  });
});
