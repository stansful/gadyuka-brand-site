import { Injectable } from '@nestjs/common';

import { UserRole } from '~core/users/user-role';
import { DatabaseService } from '~database';

export interface UserProfile {
  readonly id: string;
  readonly login: string | null;
  readonly name: string;
  readonly role: UserRole;
}

@Injectable()
export class MeRepository {
  constructor(private readonly database: DatabaseService) {}

  findProfileById(id: string): Promise<UserProfile | null> {
    return this.database.client.user.findUnique({
      where: { id },
      select: { id: true, login: true, name: true, role: true },
    });
  }
}
