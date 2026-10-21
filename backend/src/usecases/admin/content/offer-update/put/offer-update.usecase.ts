import { Injectable, Logger } from '@nestjs/common';

import type { AdminOfferInput } from '~shared/contracts/content-entities';

import { PickedMediaChecker } from '~usecases/admin/common/media/picked-media.checker';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { OfferButtonChecker } from '~usecases/admin/content/common/offers/offer-button.checker';
import { OfferFieldsFactory } from '~usecases/admin/content/common/offers/offer-fields.factory';
import { OfferRepository } from '~usecases/admin/content/common/offers/offer.repository';
import { Usecase } from '~usecases/usecase.interfaces';

export interface OfferUpdateCommand extends AdminOfferInput {
  readonly id: string;
}

/** Saves the edit form of a special offer (its place in the list stays). */
@Injectable()
export class OfferUpdateUsecase implements Usecase<OfferUpdateCommand, ContentEntitySavedResponse> {
  private readonly logger = new Logger(OfferUpdateUsecase.name);

  constructor(
    private readonly repository: OfferRepository,
    private readonly media: PickedMediaChecker,
  ) {}

  async execute(command: OfferUpdateCommand): Promise<ContentEntitySavedResponse> {
    await this.media.assertExist([command.imageId]);
    const fields = OfferFieldsFactory.fromInput(command);
    OfferButtonChecker.assertHasLink(fields);
    await this.repository.update(command.id, fields);
    this.logger.log('OfferUpdateUsecase : offer saved', { offer_id: command.id });
    return ContentEntitySavedResponse.of(command.id);
  }
}
