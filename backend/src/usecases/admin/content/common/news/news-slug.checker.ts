import { Injectable } from '@nestjs/common';

import { NewsSlugTakenException } from './news-slug-taken.exception';
import { NewsRepository } from './news.repository';

/** News slugs are unique: checked before a write so the admin gets «Адрес уже занят» on the field. */
@Injectable()
export class NewsSlugChecker {
  constructor(private readonly repository: NewsRepository) {}

  /** For a new news item: no news item has the slug. */
  async assertFree(slug: string): Promise<void> {
    if ((await this.repository.findIdBySlug(slug)) !== undefined) {
      throw new NewsSlugTakenException();
    }
  }

  /** For news item `newsId`: no OTHER news item has the slug. */
  async assertFreeFor(slug: string, newsId: string): Promise<void> {
    const ownerId = await this.repository.findIdBySlug(slug);
    if (ownerId !== undefined && ownerId !== newsId) {
      throw new NewsSlugTakenException();
    }
  }
}
