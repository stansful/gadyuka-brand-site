import { Injectable } from '@nestjs/common';
import { JwtModuleOptions, JwtOptionsFactory, JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt';

import { ConfigService } from '~config';

import { ACCESS_TOKEN_ALGORITHM, ACCESS_TOKEN_AUDIENCE, ACCESS_TOKEN_ISSUER } from './auth-token.constants';

/** Access tokens: HS256 with AUTH_ACCESS_SECRET, AUTH_ACCESS_TTL seconds, fixed issuer and audience. */
@Injectable()
export class JwtOptionsFromConfig implements JwtOptionsFactory {
  private static readonly CLAIMS = { issuer: ACCESS_TOKEN_ISSUER, audience: ACCESS_TOKEN_AUDIENCE } as const;

  constructor(private readonly config: ConfigService) {}

  createJwtOptions(): JwtModuleOptions {
    return {
      secret: this.config.getSafety('AUTH_ACCESS_SECRET'),
      signOptions: this.signOptions(),
      verifyOptions: this.verifyOptions(),
    };
  }

  private signOptions(): JwtSignOptions {
    const expiresIn = this.config.getSafety('AUTH_ACCESS_TTL');
    return { algorithm: ACCESS_TOKEN_ALGORITHM, expiresIn, ...JwtOptionsFromConfig.CLAIMS };
  }

  private verifyOptions(): JwtVerifyOptions {
    return { algorithms: [ACCESS_TOKEN_ALGORITHM], ...JwtOptionsFromConfig.CLAIMS };
  }
}
