import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserRole } from '~core/users/user-role';
import { AuthenticatedRequest, Roles } from '~decorator';
import { AuthenticationRequiredException, ForbiddenRoleException } from '~exception';

/** Global, after AuthGuard: a route with @Roles([...]) needs a signed-in user with one of them. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride(Roles, [context.getHandler(), context.getClass()]);
    if (roles !== undefined) {
      this.assertRole(context.switchToHttp().getRequest<AuthenticatedRequest>(), roles);
    }
    return true;
  }

  private assertRole({ user }: AuthenticatedRequest, roles: readonly UserRole[]): void {
    if (user === undefined) {
      throw new AuthenticationRequiredException();
    }
    if (!roles.includes(user.role)) {
      throw new ForbiddenRoleException();
    }
  }
}
