import { Injectable, Logger } from '@nestjs/common';

import { CatalogRowSavedResponse } from '~usecases/admin/catalog/common/catalog-row-saved.response';
import { CollectionSaveRules } from '~usecases/admin/catalog/common/collections/collection-save.rules';
import {
  CollectionSaveCommand,
  CollectionWriteFactory,
} from '~usecases/admin/catalog/common/collections/collection-write.factory';
import { Usecase } from '~usecases/usecase.interfaces';

import { CollectionCreateRepository } from './collection-create.repository';

/** Creates a collection (last in the list): unique slug, existing cover. */
@Injectable()
export class CollectionCreateUsecase implements Usecase<CollectionSaveCommand, CatalogRowSavedResponse> {
  private readonly logger = new Logger(CollectionCreateUsecase.name);

  constructor(
    private readonly rules: CollectionSaveRules,
    private readonly repository: CollectionCreateRepository,
  ) {}

  async execute(command: CollectionSaveCommand): Promise<CatalogRowSavedResponse> {
    const collection = CollectionWriteFactory.fromCommand(command);
    await this.rules.assertCreatable(collection);
    const id = await this.repository.create(collection);
    this.logger.log('CollectionCreateUsecase : created', { collection_id: id });
    return CatalogRowSavedResponse.of(id);
  }
}
