import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert';
import { describe, it } from 'node:test';

import { ConfigService, ConfigValidationError } from '~config';
import { TestEnvironment } from '~test/test-environment';

describe('ConfigService (environment validation)', () => {
  it('converts numbers and flags, defaults empty optional values', () => {
    const config = new ConfigService(TestEnvironment.valid({ S3_FORCE_PATH_STYLE: 'false', TELEGRAM_DRY_RUN: '' }));
    strictEqual(config.getSafety('APP_PORT'), 4000);
    strictEqual(config.getSafety('POSTGRES_PORT'), 5433);
    strictEqual(config.getSafety('S3_FORCE_PATH_STYLE'), false);
    strictEqual(config.getSafety('TELEGRAM_DRY_RUN'), false);
    strictEqual(config.getSafety('S3_REGION'), 'us-east-1');
    strictEqual(config.get('TELEGRAM_BOT_TOKEN'), undefined);
    strictEqual(config.get('LOG_DIR'), undefined);
  });

  it('keeps other variables readable', () => {
    strictEqual(new ConfigService(TestEnvironment.valid({ EXTRA: 'x' })).get('EXTRA'), 'x');
  });

  it('getSafety throws for a missing optional value', () => {
    const config = new ConfigService(TestEnvironment.valid({ ADMIN_PASSWORD: '' }));
    throws(() => config.getSafety('ADMIN_PASSWORD'), /ADMIN_PASSWORD/);
  });

  it('refuses a missing or invalid variable, naming it but never its value', () => {
    const cases: Array<[string, string | undefined]> = [
      ['NODE_ENV', 'production'],
      ['APP_PORT', 'abc'],
      ['POSTGRES_HOST', undefined],
      ['S3_ENDPOINT', 'minio:9000'],
      ['S3_BUCKET', 'Bad_Bucket'],
      ['S3_FORCE_PATH_STYLE', 'maybe'],
      ['INTERNAL_API_KEY', 'short-secret-value'],
      ['AUTH_ACCESS_SECRET', 'short-secret-value'],
      ['AUTH_ACCESS_TTL', '10'],
      ['AUTH_REFRESH_TTL', '999999999'],
      ['ADMIN_LOGIN', 'Admin User'],
      ['ADMIN_PASSWORD', 'short-secret-value'.slice(0, 10)],
      ['IP_HASH_SALT', 'salt'],
      ['IP_HASH_SALT', 'abc             '],
      ['IP_HASH_SALT', '   abc          '],
      ['SITE_URL', 'not a url'],
    ];
    for (const [name, value] of cases) {
      throws(
        () => new ConfigService(TestEnvironment.valid({ [name]: value })),
        (error: unknown) =>
          error instanceof ConfigValidationError &&
          error.message.includes(name) &&
          !error.message.includes(String(value)),
        name,
      );
    }
  });

  it('trims IP_HASH_SALT before checking its length: the checked value is the key in use', () => {
    const salt = new ConfigService(TestEnvironment.valid({ IP_HASH_SALT: '  pepper-0123456789\t' }));
    strictEqual(salt.getSafety('IP_HASH_SALT'), 'pepper-0123456789');
  });

  it('accepts the documented boolean spellings', () => {
    const values = ['1', 'true', 'YES', 'on', '0', 'false', 'no', 'Off'].map(flag =>
      new ConfigService(TestEnvironment.valid({ TELEGRAM_DRY_RUN: flag })).getSafety('TELEGRAM_DRY_RUN'),
    );
    deepStrictEqual(values, [true, true, true, true, false, false, false, false]);
    ok(new ConfigService(TestEnvironment.valid({ S3_FORCE_PATH_STYLE: '' })).getSafety('S3_FORCE_PATH_STYLE'));
  });
});
