import { randomBytes } from 'node:crypto';

import type { AuthTokensResponse } from '~shared/contracts/auth';

import { UserRole } from '~core/users/user-role';
import { DatabaseService } from '~database';
import { HashService } from '~module/hash';
import { LOGIN_ROUTE } from '~usecases/auth/login/post/login.route';

import { ApiClient } from './api-client';

/**
 * A throw-away account in the test database (removed with its sessions by `remove()`): an ADMIN by
 * default, or another role (`createWithRole`: e.g. a USER the admin routes must refuse).
 */
export class TestAdmin {
  private constructor(
    private readonly database: DatabaseService,
    readonly id: string,
    readonly login: string,
    readonly password: string,
  ) {}

  static create(database: DatabaseService): Promise<TestAdmin> {
    return TestAdmin.createWithRole(database, UserRole.ADMIN);
  }

  static async createWithRole(database: DatabaseService, role: UserRole): Promise<TestAdmin> {
    const login = `e2e-${randomBytes(6).toString('hex')}`;
    const password = randomBytes(16).toString('hex');
    const passwordHash = await new HashService({}).hash(password);
    const user = await database.client.user.create({
      data: { role, login, passwordHash, name: `E2E ${role.toLowerCase()}` },
      select: { id: true },
    });
    return new TestAdmin(database, user.id, login, password);
  }

  /** Signs in through the API; returns the access token (for `accessToken` of ApiClient requests). */
  async signIn(api: ApiClient): Promise<string> {
    const response = await api.post<AuthTokensResponse>(LOGIN_ROUTE, {
      body: { login: this.login, password: this.password },
    });
    return response.body.accessToken;
  }

  async remove(): Promise<void> {
    await this.database.client.user.delete({ where: { id: this.id } });
  }
}
