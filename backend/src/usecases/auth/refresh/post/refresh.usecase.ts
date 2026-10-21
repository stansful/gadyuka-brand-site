import { Injectable } from '@nestjs/common';

import { AuthSessionService } from '~module/auth-token';
import { AuthTokensResponse } from '~usecases/auth/common/auth-tokens.response';
import { Usecase } from '~usecases/usecase.interfaces';

export interface RefreshCommand {
  readonly refreshToken: string;
}

/** Exchanges a refresh token for a new pair (rotation; reuse of an exchanged token ends the session). */
@Injectable()
export class RefreshUsecase implements Usecase<RefreshCommand, AuthTokensResponse> {
  constructor(private readonly sessions: AuthSessionService) {}

  async execute({ refreshToken }: RefreshCommand): Promise<AuthTokensResponse> {
    return AuthTokensResponse.fromSession(await this.sessions.refresh(refreshToken));
  }
}
