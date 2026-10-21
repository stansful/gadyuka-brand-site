import { Injectable } from '@nestjs/common';

import { UserRole } from '~core/users/user-role';
import { DatabaseService } from '~database';

export interface AdminAccount {
  readonly id: string;
  readonly login: string | null;
  readonly passwordHash: string | null;
}

export interface NewAdminAccount {
  readonly id: string;
  readonly login: string;
  readonly passwordHash: string;
  readonly name: string;
}

@Injectable()
export class AdminUserRepository {
  constructor(private readonly database: DatabaseService) {}

  /** The oldest ADMIN user — the one the seed manages — or null. */
  findPrimaryAdmin(): Promise<AdminAccount | null> {
    return this.database.client.user.findFirst({
      where: { role: UserRole.ADMIN },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, login: true, passwordHash: true },
    });
  }

  async createAdmin(account: NewAdminAccount): Promise<void> {
    await this.database.client.user.create({ data: { ...account, role: UserRole.ADMIN } });
  }

  async updateLogin(id: string, login: string): Promise<void> {
    await this.database.client.user.update({ where: { id }, data: { login } });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.database.client.user.update({ where: { id }, data: { passwordHash } });
  }
}
