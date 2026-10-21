import { WriteStream, createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { ConsoleLogger, Injectable, LogLevel, OnApplicationShutdown } from '@nestjs/common';

import { ConfigService, EnvironmentEnum } from '~config';

/** Options of ConsoleLogger#printAsJson (not exported by @nestjs/common). */
interface JsonLogOptions {
  context: string;
  logLevel: LogLevel;
  writeStreamType?: 'stdout' | 'stderr';
  errorStack?: unknown;
  params?: Record<string, unknown>;
  error?: Error;
}

/**
 * The application logger: JSON lines on stdout/stderr (colored in dev), secrets redacted, and —
 * when LOG_DIR is set — the same lines appended to <LOG_DIR>/backend.log. Classes log through
 * `private readonly logger = new Logger(Class.name)`, which forwards here (main.ts: app.useLogger).
 */
@Injectable()
export class AppLogger extends ConsoleLogger implements OnApplicationShutdown {
  static readonly FILE_NAME = 'backend.log';
  private static readonly REDACTED_KEYS = [
    'password',
    'passwordHash',
    'accessToken',
    'refreshToken',
    'token',
    'secret',
    'authorization',
    'cookie',
    'x-internal-key',
  ];

  private readonly file: WriteStream | undefined;

  constructor(config: ConfigService) {
    super({
      json: true,
      colors: config.getSafety('NODE_ENV') === EnvironmentEnum.dev,
      redact: AppLogger.REDACTED_KEYS,
      logLevels: AppLogger.levelsFor(config.getSafety('NODE_ENV')),
    });
    this.file = AppLogger.openFile(config.get('LOG_DIR'));
  }

  onApplicationShutdown(): void {
    this.file?.end();
  }

  protected override printAsJson(message: unknown, options: JsonLogOptions): void {
    super.printAsJson(message, options);
    // After shutdown the file is closed (e.g. the seed CLI logs its failure after app.close()): a write
    // would crash the process with ERR_STREAM_WRITE_AFTER_END — such lines go to stdout / stderr only.
    // The same after a file error (openFile): the stream is destroyed then.
    if (this.file === undefined || this.file.writableEnded || this.file.destroyed) {
      return;
    }
    this.file.write(`${this.stringifyJsonLogObject(this.getJsonLogObject(message, options))}\n`);
  }

  private static levelsFor(environment: string): LogLevel[] {
    const levels: LogLevel[] = ['fatal', 'error', 'warn', 'log'];
    return environment === EnvironmentEnum.dev ? [...levels, 'debug'] : levels;
  }

  private static openFile(directory: string | undefined): WriteStream | undefined {
    if (directory === undefined) {
      return undefined;
    }
    mkdirSync(directory, { recursive: true });
    const path = join(directory, AppLogger.FILE_NAME);
    const file = createWriteStream(path, { flags: 'a' });
    // An unwritable log file (e.g. LOG_DIR not owned by the server's user) must not stop the server, and
    // an unhandled 'error' event of the stream would. The lines keep going to stdout / stderr.
    file.on('error', error => process.stderr.write(`[AppLogger] not writing ${path}: ${error.message}\n`));
    return file;
  }
}
