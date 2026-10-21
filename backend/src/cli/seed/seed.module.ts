import { Module } from '@nestjs/common';

import { ConfigModule } from '~config';
import { DatabaseModule } from '~database';
import { AuthTokenModule } from '~module/auth-token';
import { HashModule } from '~module/hash';
import { LoggerModule } from '~module/logger';
import { MessagesModule } from '~module/messages';

import { AdminUserRepository } from './admin-user.repository';
import { SeedStep } from './seed-step.interface';
import { SEED_STEP_LIST } from './seed.constants';
import { SeedRunner } from './seed.runner';
import { SEED_IMPORTS, SEED_PROVIDERS, SEED_STEPS } from './seed.steps';

@Module({
  imports: [
    ConfigModule.register({ isGlobal: true }),
    DatabaseModule.register({ isGlobal: true }),
    LoggerModule,
    MessagesModule,
    AuthTokenModule,
    HashModule.register({ useFactory: () => ({}) }),
    ...SEED_IMPORTS,
  ],
  providers: [
    AdminUserRepository,
    ...SEED_PROVIDERS,
    ...SEED_STEPS,
    { provide: SEED_STEP_LIST, inject: [...SEED_STEPS], useFactory: (...steps: SeedStep[]) => steps },
    SeedRunner,
  ],
})
export class SeedModule {}
