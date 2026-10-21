import { Injectable, Logger } from '@nestjs/common';

import type { AdminPartnerInput } from '~shared/contracts/content-entities';

import { ListPosition } from '~core/entities/list-position';
import { PickedMediaChecker } from '~usecases/admin/common/media/picked-media.checker';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { PartnerFieldsFactory } from '~usecases/admin/content/common/partners/partner-fields.factory';
import { PartnerRepository } from '~usecases/admin/content/common/partners/partner.repository';
import { Usecase } from '~usecases/usecase.interfaces';

/** Adds a partner to the end of the list. */
@Injectable()
export class PartnerCreateUsecase implements Usecase<AdminPartnerInput, ContentEntitySavedResponse> {
  private readonly logger = new Logger(PartnerCreateUsecase.name);

  constructor(
    private readonly repository: PartnerRepository,
    private readonly media: PickedMediaChecker,
  ) {}

  async execute(input: AdminPartnerInput): Promise<ContentEntitySavedResponse> {
    await this.media.assertExist([input.logoId]);
    const order = ListPosition.after(await this.repository.findMaxOrder());
    const id = await this.repository.create(PartnerFieldsFactory.fromInput(input), order);
    this.logger.log('PartnerCreateUsecase : partner created', { partner_id: id });
    return ContentEntitySavedResponse.of(id);
  }
}
