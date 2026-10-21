/** A complete, valid environment for unit tests that construct ConfigService (no secrets: test values only). */
export class TestEnvironment {
  private static readonly VALID: Readonly<NodeJS.ProcessEnv> = {
    NODE_ENV: 'test',
    APP_HOST: '127.0.0.1',
    APP_PORT: '4000',
    POSTGRES_NAME: 'gadyuka_test',
    POSTGRES_HOST: '127.0.0.1',
    POSTGRES_PORT: '5433',
    POSTGRES_USER: 'gadyuka',
    POSTGRES_PASS: 'test-password',
    S3_ENDPOINT: 'http://127.0.0.1:9010',
    S3_REGION: '',
    S3_BUCKET: 'gadyuka-media',
    S3_ACCESS_KEY_ID: 'gadyuka-backend',
    S3_SECRET_ACCESS_KEY: 'test-s3-secret',
    S3_FORCE_PATH_STYLE: '1',
    INTERNAL_API_KEY: 'test-internal-key-0123456789abcdef-0123456789',
    AUTH_ACCESS_SECRET: 'test-access-secret-0123456789abcdef-0123456789',
    AUTH_ACCESS_TTL: '900',
    AUTH_REFRESH_TTL: '3600',
    ADMIN_LOGIN: 'admin',
    ADMIN_PASSWORD: 'test-admin-password-123',
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_OWNER_ID: '',
    TELEGRAM_DRY_RUN: '1',
    IP_HASH_SALT: 'test-ip-hash-salt-0123',
    SITE_URL: 'http://localhost:3000',
    LOG_DIR: '',
  };

  static valid(overrides: Readonly<Record<string, string | undefined>> = {}): NodeJS.ProcessEnv {
    return { ...TestEnvironment.VALID, ...overrides };
  }
}
