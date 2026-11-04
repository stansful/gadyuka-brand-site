import { ExecutionContext } from '@nestjs/common';
import { NodeRequest } from '@nestjs/platform-node';

import type { AuthenticatedUser } from '~module/auth-token';

import { RequestHeader } from '~core/constants/request-header.enum';
import { ClientIpResolver } from '~module/common';

/** A request with the user AuthGuard attached. */
export interface AuthenticatedRequest extends NodeRequest {
  user?: AuthenticatedUser;
}

/** What the parameter decorators read from the current request. */
export class RequestContext {
  private static readonly clientIp = new ClientIpResolver();

  static currentUser(_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  }

  static clientIpOf(_data: unknown, context: ExecutionContext): string {
    return RequestContext.clientIp.resolve(context.switchToHttp().getRequest<NodeRequest>());
  }

  /**
   * The visitor's User-Agent as the site's server forwarded it (x-client-user-agent), or undefined. The
   * request's own User-Agent is the site server's HTTP client (Node's fetch sends "node"), not the visitor.
   */
  static userAgentOf(_data: unknown, context: ExecutionContext): string | undefined {
    const value = context.switchToHttp().getRequest<NodeRequest>().headers[RequestHeader.CLIENT_USER_AGENT];
    return typeof value === 'string' && value.trim() !== '' ? value : undefined;
  }
}
