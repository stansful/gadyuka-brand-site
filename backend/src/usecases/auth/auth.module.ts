import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { LOGIN_THROTTLER } from '~guard';
import { AuthTokenModule } from '~module/auth-token';
import { HashModule } from '~module/hash';
import { LoginController } from '~usecases/auth/login/post/login.controller';
import { LoginRepository } from '~usecases/auth/login/post/login.repository';
import { LoginUsecase } from '~usecases/auth/login/post/login.usecase';
import { LogoutController } from '~usecases/auth/logout/post/logout.controller';
import { LogoutUsecase } from '~usecases/auth/logout/post/logout.usecase';
import { MeController } from '~usecases/auth/me/get/me.controller';
import { MeRepository } from '~usecases/auth/me/get/me.repository';
import { MeUsecase } from '~usecases/auth/me/get/me.usecase';
import { RefreshController } from '~usecases/auth/refresh/post/refresh.controller';
import { RefreshUsecase } from '~usecases/auth/refresh/post/refresh.usecase';

@Module({
  imports: [
    AuthTokenModule,
    HashModule.register({ useFactory: () => ({}) }),
    ThrottlerModule.forRoot({ throttlers: [LOGIN_THROTTLER] }),
  ],
  controllers: [LoginController, RefreshController, LogoutController, MeController],
  providers: [LoginUsecase, LoginRepository, RefreshUsecase, LogoutUsecase, MeUsecase, MeRepository],
})
export class AuthModule {}
