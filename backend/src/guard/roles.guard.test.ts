import { strictEqual, throws } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';

import { Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
import { AuthenticationRequiredException, ForbiddenRoleException } from '~exception';
import { RolesGuard } from '~guard';
import { AuthenticatedUser } from '~module/auth-token';

/** Routes as the guard sees them: one open handler, one ADMIN-only handler. */
class ProbeController {
  open(): string {
    return 'open';
  }

  @Roles([UserRole.ADMIN])
  adminOnly(): string {
    return 'admin';
  }
}

/** Every handler of an ADMIN-only controller (role on the class). */
@Roles([UserRole.ADMIN])
class AdminProbeController {
  list(): string {
    return 'list';
  }
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  function contextOf(controller: Type, handler: () => string, user?: AuthenticatedUser): ExecutionContextHost {
    return new ExecutionContextHost([{ user }], controller, handler);
  }

  function userWith(role: UserRole): AuthenticatedUser {
    return { id: randomUUID(), role, sessionId: randomUUID() };
  }

  it('lets a route without @Roles through, signed in or not', () => {
    strictEqual(guard.canActivate(contextOf(ProbeController, ProbeController.prototype.open)), true);
  });

  it('lets an ADMIN through an ADMIN route (handler or controller level)', () => {
    const admin = userWith(UserRole.ADMIN);
    strictEqual(guard.canActivate(contextOf(ProbeController, ProbeController.prototype.adminOnly, admin)), true);
    strictEqual(guard.canActivate(contextOf(AdminProbeController, AdminProbeController.prototype.list, admin)), true);
  });

  it('refuses another role (403) and a missing user (401)', () => {
    const user = userWith(UserRole.USER);
    for (const [controller, handler] of [
      [ProbeController, ProbeController.prototype.adminOnly],
      [AdminProbeController, AdminProbeController.prototype.list],
    ] as const) {
      throws(() => guard.canActivate(contextOf(controller, handler, user)), ForbiddenRoleException);
      throws(() => guard.canActivate(contextOf(controller, handler)), AuthenticationRequiredException);
    }
  });
});
