import { Reflector } from '@nestjs/core';

import { UserRole } from '~core/users/user-role';

/** Roles allowed on a controller or route (RolesGuard): `@Roles([UserRole.ADMIN])`. */
export const Roles = Reflector.createDecorator<readonly UserRole[]>();
