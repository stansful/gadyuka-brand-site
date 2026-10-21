import { Injectable, Logger } from '@nestjs/common';

import type { AdminNewsInput } from '~shared/contracts/content-entities';

import { PickedMediaChecker } from '~usecases/admin/common/media/picked-media.checker';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { NewsFieldsFactory } from '~usecases/admin/content/common/news/news-fields.factory';
import { NewsSlugChecker } from '~usecases/admin/content/common/news/news-slug.checker';
import { NewsRepository } from '~usecases/admin/content/common/news/news.repository';
import { Usecase } from '~usecases/usecase.interfaces';

export interface NewsUpdateCommand extends AdminNewsInput {
  readonly id: string;
}

/** Saves the edit form of a news item. */
@Injectable()
export class NewsUpdateUsecase implements Usecase<NewsUpdateCommand, ContentEntitySavedResponse> {
  private readonly logger = new Logger(NewsUpdateUsecase.name);

  constructor(
    private readonly repository: NewsRepository,
    private readonly slugs: NewsSlugChecker,
    private readonly media: PickedMediaChecker,
  ) {}

  async execute(command: NewsUpdateCommand): Promise<ContentEntitySavedResponse> {
    await this.slugs.assertFreeFor(command.slug, command.id);
    await this.media.assertExist([command.imageId]);
    await this.repository.update(command.id, NewsFieldsFactory.fromInput(command));
    this.logger.log('NewsUpdateUsecase : news item saved', { news_id: command.id });
    return ContentEntitySavedResponse.of(command.id);
  }
}
