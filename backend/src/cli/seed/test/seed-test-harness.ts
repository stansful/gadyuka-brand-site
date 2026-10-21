import { randomBytes, randomUUID } from 'node:crypto';

import { Type } from '@nestjs/common';
import { StorageDisk, getDiskToken } from '@nestjs/storage';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigModule, ConfigService } from '~config';
import { UserRole } from '~core/users/user-role';
import { DatabaseModule, DatabaseService } from '~database';
import { HashService } from '~module/hash';
import { MEDIA_DISK, MediaStorageModule } from '~module/storage';
import { PrismaClient } from '~prisma-generated/prisma/client';

import { SeedMode } from '../run/seed-mode.enum';
import { SeedModule } from '../seed.module';
import { SeedRunner } from '../seed.runner';
import { SeedTestConfig } from './seed-test-config';
import { SeedTestDatabase } from './seed-test-database';

/** A provider of the seed replaced in one run (e.g. SeedAssets returning edited sources). */
export interface SeedProviderOverride {
  readonly provide: Type<unknown>;
  readonly useValue: unknown;
}

/**
 * The seed (SeedModule + SeedRunner, as `npm run db:seed` runs it) against its own database
 * (SeedTestDatabase) and the dev MinIO. The admin that owns the seed images gets a random id, so the
 * test's objects (admin/<ownerId>/…) never touch those of a real dev seed; `stop()` removes them.
 */
export class SeedTestHarness {
  private static readonly SEED_OVERWRITE: Readonly<Record<SeedMode, string>> = {
    [SeedMode.KEEP_EDITS]: '0',
    [SeedMode.OVERWRITE]: '1',
  };
  private context: TestingModule | undefined;

  private constructor(
    private readonly config: SeedTestConfig,
    private readonly database: SeedTestDatabase,
    readonly ownerId: string,
  ) {}

  static async start(): Promise<SeedTestHarness> {
    const base = await SeedTestConfig.loadBase();
    const database = new SeedTestDatabase(base);
    const harness = new SeedTestHarness(SeedTestHarness.configOf(base, database), database, randomUUID());
    await harness.resetDatabase();
    return harness;
  }

  /** The test process's environment with its own database and a throw-away admin. */
  private static configOf(base: ConfigService, database: SeedTestDatabase): SeedTestConfig {
    return new SeedTestConfig(base, {
      POSTGRES_NAME: database.name(),
      ADMIN_LOGIN: `seed-e2e-${randomBytes(6).toString('hex')}`,
      ADMIN_PASSWORD: randomBytes(16).toString('hex'),
    });
  }

  /** Prisma client of the test database (for arranging and checking rows). */
  get client(): PrismaClient {
    return this.openContext().get(DatabaseService).client;
  }

  /** The media disk (MinIO bucket of the dev environment). */
  get disk(): StorageDisk {
    return this.openContext().get<StorageDisk>(getDiskToken(MEDIA_DISK));
  }

  /** One `npm run db:seed` with SEED_OVERWRITE for `mode`. */
  async seed(mode: SeedMode, overrides: readonly SeedProviderOverride[] = []): Promise<void> {
    const moduleRef = await this.compileSeed(mode, overrides);
    await moduleRef.init();
    try {
      await moduleRef.get(SeedRunner).run();
    } finally {
      await moduleRef.close();
    }
  }

  /** An empty database again (MinIO keeps its objects) with the same owner, like a reset dev database. */
  async resetDatabase(): Promise<void> {
    await this.closeContext();
    await this.database.recreate();
    this.context = await this.createContext();
    await this.createOwner();
  }

  /** Removes the test's objects and its database. */
  async stop(): Promise<void> {
    await this.removeObjects();
    await this.closeContext();
    await this.database.drop();
  }

  /** The seed's Nest context for one run (its ConfigService and the given providers replaced). */
  private async compileSeed(mode: SeedMode, overrides: readonly SeedProviderOverride[]): Promise<TestingModule> {
    const builder = Test.createTestingModule({ imports: [SeedModule] })
      .overrideProvider(ConfigService)
      .useValue(this.config.with({ SEED_OVERWRITE: SeedTestHarness.SEED_OVERWRITE[mode] }));
    for (const { provide, useValue } of overrides) {
      builder.overrideProvider(provide).useValue(useValue);
    }
    const moduleRef = await builder.compile();
    moduleRef.useLogger(['error', 'warn']);
    return moduleRef;
  }

  private async createContext(): Promise<TestingModule> {
    const imports = [ConfigModule.register({ isGlobal: true }), DatabaseModule.register({ isGlobal: true })];
    const moduleRef = await Test.createTestingModule({ imports: [...imports, MediaStorageModule] })
      .overrideProvider(ConfigService)
      .useValue(this.config)
      .compile();
    await moduleRef.init();
    return moduleRef;
  }

  private openContext(): TestingModule {
    if (this.context === undefined) {
      throw new Error('SeedTestHarness is stopped');
    }
    return this.context;
  }

  private async closeContext(): Promise<void> {
    await this.context?.close();
    this.context = undefined;
  }

  /** The ADMIN the seed adopts (the oldest one) as the owner of the seed images. */
  private async createOwner(): Promise<void> {
    const passwordHash = await new HashService({}).hash(randomBytes(16).toString('hex'));
    const login = this.config.getSafety('ADMIN_LOGIN');
    await this.client.user.create({
      data: { id: this.ownerId, role: UserRole.ADMIN, login, passwordHash, name: 'Seed e2e owner' },
    });
  }

  private async removeObjects(): Promise<void> {
    const keys: string[] = [];
    for await (const entry of this.disk.listAll({ prefix: `admin/${this.ownerId}/` })) {
      keys.push(entry.key);
    }
    if (keys.length > 0) {
      await this.disk.delete(keys);
    }
  }
}
