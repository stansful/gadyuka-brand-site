import { Injectable } from '@nestjs/common';

import type { AdminReviewListItem } from '~shared/contracts/catalog';

import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { DatabaseService } from '~database';
import { CATALOG_LIST_LIMIT, CATALOG_LIST_ORDER } from '~usecases/admin/catalog/common/catalog-list.constants';
import { MediaRefRecord, MediaRefRow } from '~usecases/admin/common/media/media-ref.record';

interface ReviewListRow {
  readonly id: string;
  readonly author: string;
  readonly role: unknown;
  readonly text: unknown;
  readonly rating: number | null;
  readonly published: boolean;
  readonly avatar: MediaRefRow | null;
}

@Injectable()
export class ReviewListRepository {
  private static readonly SELECT = {
    id: true,
    author: true,
    role: true,
    text: true,
    rating: true,
    published: true,
    avatar: { select: MediaRefRecord.SELECT },
  } as const;

  constructor(private readonly database: DatabaseService) {}

  /** Every review in list order. */
  async findAll(): Promise<AdminReviewListItem[]> {
    const rows = await this.database.client.review.findMany({
      orderBy: CATALOG_LIST_ORDER,
      take: CATALOG_LIST_LIMIT,
      select: ReviewListRepository.SELECT,
    });
    return rows.map(row => this.toItem(row));
  }

  /** The reviews rated higher than `rating` (unrated ones never), in list order. */
  async findRatedAbove(rating: number): Promise<AdminReviewListItem[]> {
    const rows = await this.database.client.review.findMany({
      where: { rating: { gt: rating } },
      orderBy: CATALOG_LIST_ORDER,
      take: CATALOG_LIST_LIMIT,
      select: ReviewListRepository.SELECT,
    });
    return rows.map(row => this.toItem(row));
  }

  private toItem({ role, text, avatar, ...row }: ReviewListRow): AdminReviewListItem {
    return {
      ...row,
      role: LocalizedTextValue.parse(role),
      text: LocalizedTextValue.parse(text),
      avatar: MediaRefRecord.toNullableMediaRef(avatar),
    };
  }
}
