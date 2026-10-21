import { Injectable } from '@nestjs/common';

import { UserRole } from '~core/users/user-role';
import { DatabaseService } from '~database';

export interface UserCredentials {
  readonly id: string;
  readonly role: UserRole;
  readonly passwordHash: string | null;
}

@Injectable()
export class LoginRepository {
  constructor(private readonly database: DatabaseService) {}

  /** The user signing in with `login` (stored lowercase), or null. */
  findCredentialsByLogin(login: string): Promise<UserCredentials | null> {
    return this.database.client.user.findUnique({
      where: { login },
      select: { id: true, role: true, passwordHash: true },
    });
  }
}
