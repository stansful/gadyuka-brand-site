import { Injectable, Logger } from '@nestjs/common';

import type { AdminPartnerInput } from '~shared/contracts/content-entities';

import { PickedMediaChecker } from '~usecases/admin/common/media/picked-media.checker';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { PartnerFieldsFactory } from '~usecases/admin/content/common/partners/partner-fields.factory';
import { PartnerRepository } from '~usecases/admin/content/common/partners/partner.repository';
import { Usecase } from '~usecases/usecase.interfaces';

export interface PartnerUpdateCommand extends AdminPartnerInput {
  readonly id: string;
}

/** Saves the edit form of a partner (its place in the list stays). */
@Injectable()
export class PartnerUpdateUsecase implements Usecase<PartnerUpdateCommand, ContentEntitySavedResponse> {
  private readonly logger = new Logger(PartnerUpdateUsecase.name);

  constructor(
    private readonly repository: PartnerRepository,
    private readonly media: PickedMediaChecker,
  ) {}

  async execute(command: PartnerUpdateCommand): Promise<ContentEntitySavedResponse> {
    await this.media.assertExist([command.logoId]);
    await this.repository.update(command.id, PartnerFieldsFactory.fromInput(command));
    this.logger.log('PartnerUpdateUsecase : partner saved', { partner_id: command.id });
    return ContentEntitySavedResponse.of(command.id);
  }
}
