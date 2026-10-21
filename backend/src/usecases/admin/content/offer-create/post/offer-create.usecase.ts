import { Injectable, Logger } from '@nestjs/common';

import type { AdminOfferInput } from '~shared/contracts/content-entities';

import { ListPosition } from '~core/entities/list-position';
import { PickedMediaChecker } from '~usecases/admin/common/media/picked-media.checker';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { OfferButtonChecker } from '~usecases/admin/content/common/offers/offer-button.checker';
import { OfferFieldsFactory } from '~usecases/admin/content/common/offers/offer-fields.factory';
import { OfferRepository } from '~usecases/admin/content/common/offers/offer.repository';
import { Usecase } from '~usecases/usecase.interfaces';

/** Adds a special offer to the end of the list. */
@Injectable()
export class OfferCreateUsecase implements Usecase<AdminOfferInput, ContentEntitySavedResponse> {
  private readonly logger = new Logger(OfferCreateUsecase.name);

  constructor(
    private readonly repository: OfferRepository,
    private readonly media: PickedMediaChecker,
  ) {}

  async execute(input: AdminOfferInput): Promise<ContentEntitySavedResponse> {
    await this.media.assertExist([input.imageId]);
    const fields = OfferFieldsFactory.fromInput(input);
    OfferButtonChecker.assertHasLink(fields);
    const order = ListPosition.after(await this.repository.findMaxOrder());
    const id = await this.repository.create(fields, order);
    this.logger.log('OfferCreateUsecase : offer created', { offer_id: id });
    return ContentEntitySavedResponse.of(id);
  }
}
