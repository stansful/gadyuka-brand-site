import { Injectable } from '@nestjs/common';

import type { AdminCollectionDetailsResponse } from '~shared/contracts/catalog';

import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { DatabaseService } from '~database';
import { MediaRefRecord, MediaRefRow } from '~usecases/admin/common/media/media-ref.record';

interface CollectionDetailsRow {
  readonly id: string;
  readonly slug: string;
  readonly title: unknown;
  readonly description: unknown;
  readonly published: boolean;
  readonly cover: MediaRefRow | null;
  readonly _count: { readonly products: number };
}

@Injectable()
export class CollectionDetailsRepository {
  private static readonly SELECT = {
    id: true,
    slug: true,
    title: true,
    description: true,
    published: true,
    cover: { select: MediaRefRecord.SELECT },
    _count: { select: { products: true } },
  } as const;

  constructor(private readonly database: DatabaseService) {}

  async findById(id: string): Promise<AdminCollectionDetailsResponse | null> {
    const row = await this.database.client.collection.findUnique({
      where: { id },
      select: CollectionDetailsRepository.SELECT,
    });
    return row === null ? null : this.toDetails(row);
  }

  private toDetails(row: CollectionDetailsRow): AdminCollectionDetailsResponse {
    return {
      id: row.id,
      slug: row.slug,
      title: LocalizedTextValue.parse(row.title),
      description: LocalizedTextValue.parse(row.description),
      cover: MediaRefRecord.toNullableMediaRef(row.cover),
      published: row.published,
      productCount: row._count.products,
    };
  }
}
