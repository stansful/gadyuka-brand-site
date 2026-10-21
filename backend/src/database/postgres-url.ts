/**
 * The PostgreSQL connection URL, built from the POSTGRES_* parts (also used by prisma.config.ts,
 * so it must not import Nest or path aliases).
 */
export interface PostgresConnection {
  readonly host: string;
  readonly port: string | number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}

type PostgresEnvironmentKey = 'POSTGRES_HOST' | 'POSTGRES_PORT' | 'POSTGRES_USER' | 'POSTGRES_PASS' | 'POSTGRES_NAME';

export class PostgresUrl {
  private static readonly REQUIRED_KEYS: readonly PostgresEnvironmentKey[] = [
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_USER',
    'POSTGRES_PASS',
    'POSTGRES_NAME',
  ];

  constructor(private readonly connection: PostgresConnection) {}

  static hasEnvironment(env: NodeJS.ProcessEnv): boolean {
    return PostgresUrl.missingKeys(env).length === 0;
  }

  static fromEnvironment(env: NodeJS.ProcessEnv): PostgresUrl {
    const missing = PostgresUrl.missingKeys(env);
    if (missing.length > 0) {
      throw new Error(`Postgres is not configured: missing ${missing.join(', ')}`);
    }
    return new PostgresUrl(PostgresUrl.connectionOf(env));
  }

  private static connectionOf(env: NodeJS.ProcessEnv): PostgresConnection {
    return {
      host: env.POSTGRES_HOST ?? '',
      port: env.POSTGRES_PORT ?? '',
      user: env.POSTGRES_USER ?? '',
      password: env.POSTGRES_PASS ?? '',
      database: env.POSTGRES_NAME ?? '',
    };
  }

  private static missingKeys(env: NodeJS.ProcessEnv): PostgresEnvironmentKey[] {
    return PostgresUrl.REQUIRED_KEYS.filter(key => (env[key] ?? '') === '');
  }

  toString(): string {
    const { host, port, user, password, database } = this.connection;
    const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
    return `postgresql://${credentials}@${host}:${port}/${encodeURIComponent(database)}?schema=public`;
  }
}
