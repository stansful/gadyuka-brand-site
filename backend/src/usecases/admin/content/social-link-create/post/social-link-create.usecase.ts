import { Injectable, Logger } from '@nestjs/common';

import type { AdminSocialLinkInput } from '~shared/contracts/content-entities';

import { ListPosition } from '~core/entities/list-position';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { SocialLinkFieldsFactory } from '~usecases/admin/content/common/socials/social-link-fields.factory';
import { SocialLinkRepository } from '~usecases/admin/content/common/socials/social-link.repository';
import { Usecase } from '~usecases/usecase.interfaces';

/** Adds a social link to the end of the list. */
@Injectable()
export class SocialLinkCreateUsecase implements Usecase<AdminSocialLinkInput, ContentEntitySavedResponse> {
  private readonly logger = new Logger(SocialLinkCreateUsecase.name);

  constructor(private readonly repository: SocialLinkRepository) {}

  async execute(input: AdminSocialLinkInput): Promise<ContentEntitySavedResponse> {
    const order = ListPosition.after(await this.repository.findMaxOrder());
    const id = await this.repository.create(SocialLinkFieldsFactory.fromInput(input), order);
    this.logger.log('SocialLinkCreateUsecase : social link created', { social_link_id: id });
    return ContentEntitySavedResponse.of(id);
  }
}
