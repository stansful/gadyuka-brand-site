import { randomBytes } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';

import { AuthSessionService } from '~module/auth-token';
import { HASH, IHash } from '~module/hash';
import { AuthTokensResponse } from '~usecases/auth/common/auth-tokens.response';
import { Usecase } from '~usecases/usecase.interfaces';

import { InvalidCredentialsException } from './invalid-credentials.exception';
import { LoginRepository, UserCredentials } from './login.repository';

export interface LoginCommand {
  readonly login: string;
  readonly password: string;
  readonly userAgent: string | undefined;
}

/**
 * Sign-in with login + password: a new session (access + refresh token). An unknown login costs the
 * same scrypt work as a wrong password, so the answer time does not reveal which logins exist.
 */
@Injectable()
export class LoginUsecase implements Usecase<LoginCommand, AuthTokensResponse> {
  /** Random bytes of the never-shown password behind the dummy hash. */
  private static readonly DUMMY_PASSWORD_BYTES = 32;
  private readonly logger = new Logger(LoginUsecase.name);
  /** Verified against when the login is unknown (equal timing). */
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly repository: LoginRepository,
    private readonly sessions: AuthSessionService,
    @Inject(HASH) private readonly hash: IHash,
  ) {
    this.dummyHash = this.hash.hash(randomBytes(LoginUsecase.DUMMY_PASSWORD_BYTES).toString('hex'));
  }

  async execute({ login, password, userAgent }: LoginCommand): Promise<AuthTokensResponse> {
    const user = await this.repository.findCredentialsByLogin(login.trim().toLowerCase());
    const isValid = await this.isPasswordValid(user, password);
    if (user === null || !isValid) {
      throw new InvalidCredentialsException();
    }
    this.logger.log('LoginUsecase : signed in', { user_id: user.id });
    return AuthTokensResponse.fromSession(await this.sessions.start({ userId: user.id, role: user.role, userAgent }));
  }

  private async isPasswordValid(user: UserCredentials | null, password: string): Promise<boolean> {
    if (user === null || user.passwordHash === null) {
      await this.hash.verify(password, await this.dummyHash);
      return false;
    }
    return this.hash.verify(password, user.passwordHash);
  }
}
