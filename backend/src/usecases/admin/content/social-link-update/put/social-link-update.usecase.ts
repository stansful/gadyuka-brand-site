import { Injectable, Logger } from '@nestjs/common';

import type { AdminSocialLinkInput } from '~shared/contracts/content-entities';

import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { SocialLinkFieldsFactory } from '~usecases/admin/content/common/socials/social-link-fields.factory';
import { SocialLinkRepository } from '~usecases/admin/content/common/socials/social-link.repository';
import { Usecase } from '~usecases/usecase.interfaces';

export interface SocialLinkUpdateCommand extends AdminSocialLinkInput {
  readonly id: string;
}

/** Saves the edit form of a social link (its place in the list stays). */
@Injectable()
export class SocialLinkUpdateUsecase implements Usecase<SocialLinkUpdateCommand, ContentEntitySavedResponse> {
  private readonly logger = new Logger(SocialLinkUpdateUsecase.name);

  constructor(private readonly repository: SocialLinkRepository) {}

  async execute(command: SocialLinkUpdateCommand): Promise<ContentEntitySavedResponse> {
    await this.repository.update(command.id, SocialLinkFieldsFactory.fromInput(command));
    this.logger.log('SocialLinkUpdateUsecase : social link saved', { social_link_id: command.id });
    return ContentEntitySavedResponse.of(command.id);
  }
}
