import { Inject, Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '~config';
import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { SessionRevokeReason } from '~core/sessions/session-revoke-reason';
import { AuthSessionService } from '~module/auth-token';
import { HASH, IHash } from '~module/hash';
import { MessageCatalog } from '~module/messages';

import { AdminCredentialsMissingError } from './admin-credentials-missing.error';
import { AdminAccount, AdminUserRepository } from './admin-user.repository';
import { SeedStep } from './seed-step.interface';
import { FALLBACK_ADMIN_NAME, SEED_ADMIN_USER_ID } from './seed.constants';

interface AdminCredentials {
  readonly login: string;
  readonly password: string;
}

/**
 * The admin account from ADMIN_LOGIN / ADMIN_PASSWORD. Idempotent: creates the ADMIN when there is
 * none, otherwise brings the oldest ADMIN's login and password in line with the environment; a new
 * password ends every session of that user.
 */
@Injectable()
export class AdminUserSeed implements SeedStep {
  private readonly logger = new Logger(AdminUserSeed.name);

  constructor(
    private readonly config: ConfigService,
    private readonly repository: AdminUserRepository,
    private readonly sessions: AuthSessionService,
    private readonly catalog: MessageCatalog,
    @Inject(HASH) private readonly hash: IHash,
  ) {}

  async run(): Promise<void> {
    const credentials = this.readCredentials();
    const existing = await this.repository.findPrimaryAdmin();
    if (existing === null) {
      await this.create(credentials);
      return;
    }
    await this.syncLogin(existing, credentials.login);
    await this.syncPassword(existing, credentials.password);
  }

  private readCredentials(): AdminCredentials {
    const login = this.config.get('ADMIN_LOGIN');
    const password = this.config.get('ADMIN_PASSWORD');
    if (login === undefined || password === undefined) {
      throw new AdminCredentialsMissingError();
    }
    return { login: login.toLowerCase(), password };
  }

  private async create({ login, password }: AdminCredentials): Promise<void> {
    const name = this.catalog.findAdminMessage(AdminMessageKey.COMMON_ADMIN_USER_NAME) ?? FALLBACK_ADMIN_NAME;
    await this.repository.createAdmin({
      id: SEED_ADMIN_USER_ID,
      login,
      passwordHash: await this.hash.hash(password),
      name,
    });
    this.logger.log('AdminUserSeed : admin created', { user_id: SEED_ADMIN_USER_ID });
  }

  private async syncLogin(admin: AdminAccount, login: string): Promise<void> {
    if (admin.login === login) {
      return;
    }
    await this.repository.updateLogin(admin.id, login);
    this.logger.log('AdminUserSeed : admin login updated', { user_id: admin.id });
  }

  private async syncPassword(admin: AdminAccount, password: string): Promise<void> {
    if (admin.passwordHash !== null && (await this.hash.verify(password, admin.passwordHash))) {
      return;
    }
    await this.repository.updatePasswordHash(admin.id, await this.hash.hash(password));
    const revoked = await this.sessions.revokeAllForUser(admin.id, SessionRevokeReason.PASSWORD_CHANGE);
    this.logger.log('AdminUserSeed : admin password updated, sessions ended', { user_id: admin.id, sessions: revoked });
  }
}
