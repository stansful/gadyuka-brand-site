import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { MILLISECONDS_PER_SECOND } from '~core/constants/time.constants';
import { UserRole } from '~core/users/user-role';
import { AccessTokenInvalidException } from '~exception';

import { AccessTokenClaims, AuthenticatedUser, IssuedToken } from './auth-token.interfaces';

/** Short-lived HS512 access tokens over @nestjs/jwt: { sub: user id, role, sid: session id }. */
@Injectable()
export class AccessTokenService {
  private static readonly ROLES: ReadonlySet<string> = new Set(Object.values(UserRole));

  constructor(private readonly jwt: JwtService) {}

  issue(user: AuthenticatedUser): IssuedToken {
    const claims: AccessTokenClaims = { sub: user.id, role: user.role, sid: user.sessionId };
    const token = this.jwt.sign(claims);
    return { token, expiresAt: this.expiryOf(token) };
  }

  /** The claims of a valid token (signature, algorithm, issuer, audience, expiry); throws otherwise. */
  verify(token: string): AccessTokenClaims {
    let payload: unknown;
    try {
      payload = this.jwt.verify<object>(token);
    } catch (error: unknown) {
      throw new AccessTokenInvalidException(error);
    }
    if (!this.hasClaims(payload)) {
      throw new AccessTokenInvalidException();
    }
    return { sub: payload.sub, role: payload.role, sid: payload.sid };
  }

  private hasClaims(payload: unknown): payload is AccessTokenClaims {
    if (typeof payload !== 'object' || payload === null) {
      return false;
    }
    const { sub, role, sid } = payload as Partial<Record<keyof AccessTokenClaims, unknown>>;
    return (
      typeof sub === 'string' &&
      typeof sid === 'string' &&
      typeof role === 'string' &&
      AccessTokenService.ROLES.has(role)
    );
  }

  private expiryOf(token: string): Date {
    const { exp } = this.jwt.decode<{ exp: number }>(token);
    return new Date(exp * MILLISECONDS_PER_SECOND);
  }
}
