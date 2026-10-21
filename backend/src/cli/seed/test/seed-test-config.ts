import { Test } from '@nestjs/testing';

import { ConfigModule, ConfigService } from '~config';
import { IConfigService, IEnvironmentIncomingKey, IEnvironmentResponseKey } from '~config/config.interfaces';

/** Text variables an e2e run of the seed replaces (its own database, admin and SEED_OVERWRITE). */
export type SeedTestVariable = 'POSTGRES_NAME' | 'ADMIN_LOGIN' | 'ADMIN_PASSWORD' | 'SEED_OVERWRITE';

/**
 * The environment of the test process (ConfigModule: .env, .env.test, the slice runner's variables)
 * with a few text variables replaced — passed to the seed's Nest context instead of ConfigService.
 */
export class SeedTestConfig implements IConfigService {
  constructor(
    private readonly base: ConfigService,
    private readonly overrides: Readonly<Partial<Record<SeedTestVariable, string>>>,
  ) {}

  /** The validated environment of this test process. */
  static async loadBase(): Promise<ConfigService> {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.register({ isGlobal: false })],
    }).compile();
    const config = moduleRef.get(ConfigService);
    await moduleRef.close();
    return config;
  }

  with(overrides: Readonly<Partial<Record<SeedTestVariable, string>>>): SeedTestConfig {
    return new SeedTestConfig(this.base, { ...this.overrides, ...overrides });
  }

  get<T extends IEnvironmentIncomingKey>(env: T): IEnvironmentResponseKey<T> | undefined {
    if (!this.isOverridden(env)) {
      return this.base.get(env);
    }
    // Only text variables are overridden (SeedTestVariable), and their values are text.
    return this.overrides[env] as IEnvironmentResponseKey<T> | undefined;
  }

  getSafety<T extends IEnvironmentIncomingKey>(env: T): IEnvironmentResponseKey<T> {
    const value = this.get(env);
    if (value === undefined) {
      throw new Error(`Cannot get env key: ${String(env)}`);
    }
    return value;
  }

  private isOverridden(env: IEnvironmentIncomingKey): env is SeedTestVariable {
    return Object.hasOwn(this.overrides, env);
  }
}
