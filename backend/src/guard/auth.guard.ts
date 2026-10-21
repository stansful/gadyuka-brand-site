import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RequestHeader } from '~core/constants/request-header.enum';
import { AuthenticatedRequest, Public } from '~decorator';
import { AuthenticationRequiredException } from '~exception';
import { AuthSessionService } from '~module/auth-token';

/**
 * Global: a route needs `Authorization: Bearer <access token>` of a session that is not revoked,
 * unless it is @Public(). The user is attached to the request (@CurrentUser()).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private static readonly BEARER = /^Bearer\s+(\S+)$/i;

  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: AuthSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride(Public, [context.getHandler(), context.getClass()])) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = await this.sessions.authenticate(this.bearerTokenOf(request));
    return true;
  }

  private bearerTokenOf(request: AuthenticatedRequest): string {
    const header = request.headers[RequestHeader.AUTHORIZATION];
    const match = typeof header === 'string' ? AuthGuard.BEARER.exec(header.trim()) : null;
    if (match === null || match[1] === undefined) {
      throw new AuthenticationRequiredException();
    }
    return match[1];
  }
}
