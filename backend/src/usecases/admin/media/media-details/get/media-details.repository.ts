import { Injectable } from '@nestjs/common';

import { MAX_USAGES_PER_KIND } from '~core/media/media-library.constants';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';
import { MediaRecord } from '~usecases/admin/media/common/media-record';
import { MediaRecordMapper } from '~usecases/admin/media/common/media-record.mapper';

const TITLED_ROWS = { select: { id: true, title: true }, take: MAX_USAGES_PER_KIND } as const;

/** The rows that reference a media file, per relation: what the admin needs to name and link them. */
const USAGE_ROWS_SELECT = {
  contentImages: { select: { key: true }, take: MAX_USAGES_PER_KIND },
  collectionCovers: TITLED_ROWS,
  productImages: { select: { product: { select: { id: true, title: true } } }, take: MAX_USAGES_PER_KIND },
  reviewAvatars: { select: { id: true, author: true }, take: MAX_USAGES_PER_KIND },
  newsImages: TITLED_ROWS,
  galleryItems: { select: { id: true, caption: true }, take: MAX_USAGES_PER_KIND },
  offerImages: TITLED_ROWS,
  partnerLogos: { select: { id: true, name: true }, take: MAX_USAGES_PER_KIND },
  ogImageSettings: { select: { id: true }, take: 1 },
} satisfies Prisma.MediaSelect;

/** A referencing row with its stored (translatable JSON) title. */
export interface TitledUsageRow {
  readonly id: string;
  readonly title: unknown;
}

/** The rows that reference one media file, per relation. */
export interface MediaUsageRows {
  readonly contentImages: readonly { readonly key: string }[];
  readonly collectionCovers: readonly TitledUsageRow[];
  readonly productImages: readonly { readonly product: TitledUsageRow }[];
  readonly reviewAvatars: readonly { readonly id: string; readonly author: string }[];
  readonly newsImages: readonly TitledUsageRow[];
  readonly galleryItems: readonly { readonly id: string; readonly caption: unknown }[];
  readonly offerImages: readonly TitledUsageRow[];
  readonly partnerLogos: readonly { readonly id: string; readonly name: string }[];
  readonly ogImageSettings: readonly { readonly id: number }[];
}

@Injectable()
export class MediaDetailsRepository {
  constructor(private readonly database: DatabaseService) {}

  async findMedia(id: string): Promise<MediaRecord | null> {
    const row = await this.database.client.media.findUnique({ where: { id }, select: MediaRecordMapper.SELECT });
    return row === null ? null : MediaRecordMapper.toRecord(row);
  }

  /** The rows that reference the file (null when the file does not exist). */
  async findUsageRows(id: string): Promise<MediaUsageRows | null> {
    return this.database.client.media.findUnique({ where: { id }, select: USAGE_ROWS_SELECT });
  }
}
