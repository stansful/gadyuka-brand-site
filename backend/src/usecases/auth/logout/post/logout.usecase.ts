import { Injectable } from '@nestjs/common';

import { AuthSessionService } from '~module/auth-token';
import { Usecase } from '~usecases/usecase.interfaces';

export interface LogoutCommand {
  readonly refreshToken: string;
}

/** Ends the session of a refresh token. Idempotent: an unknown or revoked token is ignored. */
@Injectable()
export class LogoutUsecase implements Usecase<LogoutCommand, void> {
  constructor(private readonly sessions: AuthSessionService) {}

  async execute({ refreshToken }: LogoutCommand): Promise<void> {
    await this.sessions.end(refreshToken);
  }
}
