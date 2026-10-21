import { Injectable } from '@nestjs/common';

import { ContentEntityNotFoundException } from '~usecases/admin/content/common/exceptions/content-entity-not-found.exception';
import { SocialLinkDetailsResponse } from '~usecases/admin/content/common/socials/social-link-details.response';
import { SocialLinkRepository } from '~usecases/admin/content/common/socials/social-link.repository';
import { Usecase } from '~usecases/usecase.interfaces';

export interface SocialLinkDetailsQuery {
  readonly id: string;
}

/** One social link for the edit form. */
@Injectable()
export class SocialLinkDetailsUsecase implements Usecase<SocialLinkDetailsQuery, SocialLinkDetailsResponse> {
  constructor(private readonly repository: SocialLinkRepository) {}

  async execute({ id }: SocialLinkDetailsQuery): Promise<SocialLinkDetailsResponse> {
    const record = await this.repository.findById(id);
    if (record === undefined) {
      throw new ContentEntityNotFoundException();
    }
    return SocialLinkDetailsResponse.of(record);
  }
}
