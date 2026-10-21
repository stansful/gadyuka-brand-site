import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { Client } from 'pg';

import { ConfigService } from '~config';

/**
 * A database of its own for the seed e2e test: `<POSTGRES_NAME>_seed_e2e` on the dev Postgres, built
 * from prisma/migrations. The seed manages global rows (the primary admin, every Message row, the
 * settings singleton, fixed slugs), so it must not run in the database other e2e files share.
 */
export class SeedTestDatabase {
  private static readonly SUFFIX = '_seed_e2e';
  private static readonly MAINTENANCE_DATABASE = 'postgres';
  private static readonly MIGRATIONS = join('prisma', 'migrations');
  private static readonly MIGRATION_FILE = 'migration.sql';

  constructor(private readonly config: ConfigService) {}

  name(): string {
    return `${this.config.getSafety('POSTGRES_NAME')}${SeedTestDatabase.SUFFIX}`;
  }

  /** Drops the database (closing its connections) and builds it again from the migrations. */
  async recreate(): Promise<void> {
    await this.drop();
    await this.withClient(SeedTestDatabase.MAINTENANCE_DATABASE, client =>
      client.query(`CREATE DATABASE ${client.escapeIdentifier(this.name())}`),
    );
    await this.withClient(this.name(), client => this.migrate(client));
  }

  async drop(): Promise<void> {
    await this.withClient(SeedTestDatabase.MAINTENANCE_DATABASE, client =>
      client.query(`DROP DATABASE IF EXISTS ${client.escapeIdentifier(this.name())} WITH (FORCE)`),
    );
  }

  private async migrate(client: Client): Promise<void> {
    for (const script of this.migrationScripts()) {
      await client.query(script);
    }
  }

  /** migration.sql of every migration, in order (folder names start with their timestamp). */
  private migrationScripts(): string[] {
    const directory = this.locateMigrations();
    return readdirSync(directory)
      .filter(name => existsSync(join(directory, name, SeedTestDatabase.MIGRATION_FILE)))
      .sort()
      .map(name => readFileSync(join(directory, name, SeedTestDatabase.MIGRATION_FILE), 'utf8'));
  }

  private locateMigrations(start: string = __dirname): string {
    for (let directory = start; ; directory = dirname(directory)) {
      const candidate = join(directory, SeedTestDatabase.MIGRATIONS);
      if (existsSync(candidate)) {
        return candidate;
      }
      if (dirname(directory) === directory) {
        throw new Error(`prisma/migrations not found above ${start}`);
      }
    }
  }

  private async withClient<T>(database: string, work: (client: Client) => Promise<T>): Promise<T> {
    const client = this.clientOf(database);
    await client.connect();
    try {
      return await work(client);
    } finally {
      await client.end();
    }
  }

  private clientOf(database: string): Client {
    return new Client({
      host: this.config.getSafety('POSTGRES_HOST'),
      port: this.config.getSafety('POSTGRES_PORT'),
      user: this.config.getSafety('POSTGRES_USER'),
      password: this.config.getSafety('POSTGRES_PASS'),
      database,
    });
  }
}
