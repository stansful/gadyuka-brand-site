import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AccessTokenService } from './access-token.service';
import { AuthSessionService } from './auth-session.service';
import { SESSION_REPOSITORY } from './auth-token.constants';
import { JwtOptionsFromConfig } from './jwt-options.factory';
import { RefreshTokenCodec } from './refresh-token.codec';
import { SessionRepository } from './session.repository';

@Module({
  imports: [JwtModule.registerAsync({ useClass: JwtOptionsFromConfig })],
  providers: [
    AccessTokenService,
    RefreshTokenCodec,
    AuthSessionService,
    { provide: SESSION_REPOSITORY, useClass: SessionRepository },
  ],
  exports: [AuthSessionService, AccessTokenService],
})
export class AuthTokenModule {}
