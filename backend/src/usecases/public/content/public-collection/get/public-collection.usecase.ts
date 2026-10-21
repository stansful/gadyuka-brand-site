import { Injectable } from '@nestjs/common';

import { Locale } from '~core/locales/locale.enum';
import { PublicCollectionPresenter } from '~usecases/public/content/common/public-collection.presenter';
import { PublishedCollectionsRepository } from '~usecases/public/content/common/published-collections.repository';
import { Usecase } from '~usecases/usecase.interfaces';

import { PublicCollectionNotFoundException } from './public-collection-not-found.exception';
import { PublicCollectionResponse } from './public-collection.response';

export interface PublicCollectionQuery {
  readonly slug: string;
  readonly locale: Locale;
}

/** One published collection with its published products (port of the frontend's getCollectionBySlug). */
@Injectable()
export class PublicCollectionUsecase implements Usecase<PublicCollectionQuery, PublicCollectionResponse> {
  constructor(
    private readonly collections: PublishedCollectionsRepository,
    private readonly presenter: PublicCollectionPresenter,
  ) {}

  async execute({ slug, locale }: PublicCollectionQuery): Promise<PublicCollectionResponse> {
    const row = await this.collections.findBySlug(slug);
    if (row === null) {
      throw new PublicCollectionNotFoundException();
    }
    return PublicCollectionResponse.of(locale, this.presenter.toCollection(row, locale));
  }
}
