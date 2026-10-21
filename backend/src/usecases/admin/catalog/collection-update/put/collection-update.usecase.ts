import { Injectable, Logger } from '@nestjs/common';

import { CatalogRowSavedResponse } from '~usecases/admin/catalog/common/catalog-row-saved.response';
import { CollectionSaveRules } from '~usecases/admin/catalog/common/collections/collection-save.rules';
import {
  CollectionSaveCommand,
  CollectionWriteFactory,
} from '~usecases/admin/catalog/common/collections/collection-write.factory';
import { Usecase } from '~usecases/usecase.interfaces';

import { CollectionUpdateRepository } from './collection-update.repository';

export interface CollectionUpdateCommand extends CollectionSaveCommand {
  readonly id: string;
}

/** Saves the edit form of a collection: unique slug, existing cover; 404 when it was deleted. */
@Injectable()
export class CollectionUpdateUsecase implements Usecase<CollectionUpdateCommand, CatalogRowSavedResponse> {
  private readonly logger = new Logger(CollectionUpdateUsecase.name);

  constructor(
    private readonly rules: CollectionSaveRules,
    private readonly repository: CollectionUpdateRepository,
  ) {}

  async execute({ id, ...fields }: CollectionUpdateCommand): Promise<CatalogRowSavedResponse> {
    const collection = CollectionWriteFactory.fromCommand(fields);
    await this.rules.assertUpdatable(id, collection);
    await this.repository.update(id, collection);
    this.logger.log('CollectionUpdateUsecase : saved', { collection_id: id });
    return CatalogRowSavedResponse.of(id);
  }
}
