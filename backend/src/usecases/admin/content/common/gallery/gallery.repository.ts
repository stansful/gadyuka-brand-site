import { Injectable } from '@nestjs/common';

import { MAX_ADMIN_LIST_ROWS } from '~core/content-entities/content-limits.constants';
import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';
import { MediaRefRecord } from '~usecases/admin/common/media/media-ref.record';

import { GalleryBulkRows, GalleryFields, GalleryRecord } from './gallery.records';

const GALLERY_SELECT = {
  id: true,
  caption: true,
  published: true,
  media: { select: MediaRefRecord.SELECT },
} as const satisfies Prisma.GalleryItemSelect;

type GalleryRow = Prisma.GalleryItemGetPayload<{ select: typeof GALLERY_SELECT }>;

/** Gallery items of the admin (gallery_items). */
@Injectable()
export class GalleryRepository {
  constructor(private readonly database: DatabaseService) {}

  /** In the manual order (then the older first). */
  async findList(): Promise<GalleryRecord[]> {
    const rows = await this.database.client.galleryItem.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      take: MAX_ADMIN_LIST_ROWS,
      select: GALLERY_SELECT,
    });
    return rows.map(row => this.toRecord(row));
  }

  async findById(id: string): Promise<GalleryRecord | undefined> {
    const row = await this.database.client.galleryItem.findUnique({ where: { id }, select: GALLERY_SELECT });
    return row === null ? undefined : this.toRecord(row);
  }

  /** The highest order of the gallery (null: no items yet). */
  async findMaxOrder(): Promise<number | null> {
    const result = await this.database.client.galleryItem.aggregate({ _max: { order: true } });
    return result._max.order;
  }

  async create(fields: GalleryFields, order: number): Promise<string> {
    const row = await this.database.client.galleryItem.create({ data: { ...fields, order }, select: { id: true } });
    return row.id;
  }

  /** Rows created. */
  async createMany({ mediaIds, published, firstOrder }: GalleryBulkRows): Promise<number> {
    const data = mediaIds.map((mediaId, index) => ({ mediaId, order: firstOrder + index, published, caption: {} }));
    const result = await this.database.client.galleryItem.createMany({ data });
    return result.count;
  }

  /** A missing row → Prisma P2025 → 404 notFound (ApiExceptionFilter). */
  async update(id: string, fields: GalleryFields): Promise<void> {
    await this.database.client.galleryItem.update({ where: { id }, data: fields, select: { id: true } });
  }

  private toRecord(row: GalleryRow): GalleryRecord {
    return {
      id: row.id,
      media: MediaRefRecord.toMediaRef(row.media),
      caption: LocalizedTextValue.parse(row.caption),
      published: row.published,
    };
  }
}
