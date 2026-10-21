import { Injectable } from '@nestjs/common';

import { SocialLinkRepository } from '~usecases/admin/content/common/socials/social-link.repository';
import { Usecase } from '~usecases/usecase.interfaces';

import { SocialLinkListResponse } from './social-link-list.response';

/** The admin's social links (manual order; placeholder links flagged). */
@Injectable()
export class SocialLinkListUsecase implements Usecase<void, SocialLinkListResponse> {
  constructor(private readonly repository: SocialLinkRepository) {}

  async execute(): Promise<SocialLinkListResponse> {
    return SocialLinkListResponse.of(await this.repository.findList());
  }
}
