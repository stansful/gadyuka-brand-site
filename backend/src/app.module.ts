import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';

import { ApiExceptionFilter } from '~exception';
import { AuthGuard, InternalKeyGuard, RolesGuard } from '~guard';
import { AuthTokenModule } from '~module/auth-token';
import { LoggerModule } from '~module/logger';
import { UsecaseModule } from '~usecases/usecase.module';

import { ConfigModule } from './config';
import { DatabaseModule } from './database';
import { ApiValidationPipe } from './pipe/api-validation.pipe';

@Module({
  imports: [
    ConfigModule.register({ isGlobal: true }),
    DatabaseModule.register({ isGlobal: true }),
    LoggerModule,
    AuthTokenModule,
    UsecaseModule,
  ],
  providers: [
    // Guards run in this order: internal key → signed-in user → role.
    { provide: APP_GUARD, useClass: InternalKeyGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_PIPE, useClass: ApiValidationPipe },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
