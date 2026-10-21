import { Injectable } from '@nestjs/common';

import type { AdminReviewDetailsResponse } from '~shared/contracts/catalog';

import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { DatabaseService } from '~database';
import { MediaRefRecord, MediaRefRow } from '~usecases/admin/common/media/media-ref.record';

interface ReviewDetailsRow {
  readonly id: string;
  readonly author: string;
  readonly role: unknown;
  readonly text: unknown;
  readonly rating: number | null;
  readonly published: boolean;
  readonly avatar: MediaRefRow | null;
}

@Injectable()
export class ReviewDetailsRepository {
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

  async findById(id: string): Promise<AdminReviewDetailsResponse | null> {
    const row = await this.database.client.review.findUnique({
      where: { id },
      select: ReviewDetailsRepository.SELECT,
    });
    return row === null ? null : this.toDetails(row);
  }

  private toDetails({ role, text, avatar, ...row }: ReviewDetailsRow): AdminReviewDetailsResponse {
    return {
      ...row,
      role: LocalizedTextValue.parse(role),
      text: LocalizedTextValue.parse(text),
      avatar: MediaRefRecord.toNullableMediaRef(avatar),
    };
  }
}
