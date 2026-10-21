import { Injectable } from '@nestjs/common';

import { AccessTokenInvalidException } from '~exception';
import { AuthenticatedUser } from '~module/auth-token';
import { Usecase } from '~usecases/usecase.interfaces';

import { MeRepository } from './me.repository';
import { MeResponse } from './me.response';

/** The signed-in user and the current session. */
@Injectable()
export class MeUsecase implements Usecase<AuthenticatedUser, MeResponse> {
  constructor(private readonly repository: MeRepository) {}

  async execute({ id, sessionId }: AuthenticatedUser): Promise<MeResponse> {
    const profile = await this.repository.findProfileById(id);
    if (profile === null) {
      throw new AccessTokenInvalidException();
    }
    return Object.assign(new MeResponse(), { ...profile, sessionId });
  }
}
