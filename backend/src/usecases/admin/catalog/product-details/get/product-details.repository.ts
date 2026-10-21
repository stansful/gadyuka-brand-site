import { Injectable } from '@nestjs/common';

import type { AdminProductDetailsResponse } from '~shared/contracts/catalog';

import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { DatabaseService } from '~database';
import { MediaRefRecord, MediaRefRow } from '~usecases/admin/common/media/media-ref.record';

interface ProductDetailsRow {
  readonly id: string;
  readonly slug: string;
  readonly collectionId: string;
  readonly title: unknown;
  readonly description: unknown;
  readonly details: unknown;
  readonly price: number | null;
  readonly published: boolean;
  readonly images: ReadonlyArray<{ readonly media: MediaRefRow }>;
}

@Injectable()
export class ProductDetailsRepository {
  private static readonly SELECT = {
    id: true,
    slug: true,
    collectionId: true,
    title: true,
    description: true,
    details: true,
    price: true,
    published: true,
    images: { orderBy: { order: 'asc' }, select: { media: { select: MediaRefRecord.SELECT } } },
  } as const;

  constructor(private readonly database: DatabaseService) {}

  async findById(id: string): Promise<AdminProductDetailsResponse | null> {
    const row = await this.database.client.product.findUnique({
      where: { id },
      select: ProductDetailsRepository.SELECT,
    });
    return row === null ? null : this.toDetails(row);
  }

  private toDetails({ title, description, details, images, ...row }: ProductDetailsRow): AdminProductDetailsResponse {
    return {
      ...row,
      title: LocalizedTextValue.parse(title),
      description: LocalizedTextValue.parse(description),
      details: LocalizedTextValue.parse(details),
      images: images.map(image => MediaRefRecord.toMediaRef(image.media)),
    };
  }
}
