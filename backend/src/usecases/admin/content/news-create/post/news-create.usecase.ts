import { Injectable, Logger } from '@nestjs/common';

import type { AdminNewsInput } from '~shared/contracts/content-entities';

import { PickedMediaChecker } from '~usecases/admin/common/media/picked-media.checker';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { NewsFieldsFactory } from '~usecases/admin/content/common/news/news-fields.factory';
import { NewsSlugChecker } from '~usecases/admin/content/common/news/news-slug.checker';
import { NewsRepository } from '~usecases/admin/content/common/news/news.repository';
import { Usecase } from '~usecases/usecase.interfaces';

/** Adds a news item (the site orders the news by date). */
@Injectable()
export class NewsCreateUsecase implements Usecase<AdminNewsInput, ContentEntitySavedResponse> {
  private readonly logger = new Logger(NewsCreateUsecase.name);

  constructor(
    private readonly repository: NewsRepository,
    private readonly slugs: NewsSlugChecker,
    private readonly media: PickedMediaChecker,
  ) {}

  async execute(input: AdminNewsInput): Promise<ContentEntitySavedResponse> {
    await this.slugs.assertFree(input.slug);
    await this.media.assertExist([input.imageId]);
    const id = await this.repository.create(NewsFieldsFactory.fromInput(input));
    this.logger.log('NewsCreateUsecase : news item created', { news_id: id });
    return ContentEntitySavedResponse.of(id);
  }
}
