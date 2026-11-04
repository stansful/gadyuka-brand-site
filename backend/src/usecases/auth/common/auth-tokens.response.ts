import { ApiProperty } from '@nestjs/swagger';

import type { AuthTokensResponse as AuthTokensResponseContract } from '~shared/contracts/auth';

import { SessionTokens } from '~module/auth-token';

/** Answer of POST /auth/login and POST /auth/refresh. */
export class AuthTokensResponse implements AuthTokensResponseContract {
  @ApiProperty({ enum: ['Bearer'] })
  tokenType: 'Bearer';

  @ApiProperty({ description: 'HS512 JWT for `Authorization: Bearer …`' })
  accessToken: string;

  @ApiProperty({ description: 'ISO 8601', example: '2026-10-21T12:15:00.000Z' })
  accessExpiresAt: string;

  @ApiProperty({ description: 'Opaque "<id>.<secret>"; exchanged at most once (POST /auth/refresh)' })
  refreshToken: string;

  @ApiProperty({ description: 'ISO 8601', example: '2026-11-20T12:00:00.000Z' })
  refreshExpiresAt: string;

  static fromSession({ access, refresh }: SessionTokens): AuthTokensResponse {
    return Object.assign(new AuthTokensResponse(), {
      tokenType: 'Bearer' as const,
      accessToken: access.token,
      accessExpiresAt: access.expiresAt.toISOString(),
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt.toISOString(),
    });
  }
}
