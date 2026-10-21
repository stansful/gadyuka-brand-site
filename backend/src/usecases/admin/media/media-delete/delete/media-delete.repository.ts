import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';
import { StoredMediaObject } from '~usecases/admin/media/common/media-object.cleaner';
import { MediaRecordMapper } from '~usecases/admin/media/common/media-record.mapper';

const DELETABLE_SELECT = {
  id: true,
  bucket: true,
  key: true,
  _count: { select: MediaRecordMapper.USAGE_COUNT_SELECT },
} satisfies Prisma.MediaSelect;

/** A media row about to be deleted: where its file is and how many places reference it. */
export interface DeletableMedia extends StoredMediaObject {
  readonly id: string;
  readonly usageCount: number;
}

@Injectable()
export class MediaDeleteRepository {
  constructor(private readonly database: DatabaseService) {}

  async findDeletable(id: string): Promise<DeletableMedia | null> {
    const row = await this.database.client.media.findUnique({ where: { id }, select: DELETABLE_SELECT });
    if (row === null) {
      return null;
    }
    const { _count: counts, ...media } = row;
    return { ...media, usageCount: MediaRecordMapper.sum(counts) };
  }

  /**
   * Restrict foreign keys (gallery items, product images) make the database refuse when a reference
   * appeared meanwhile → 409 admin.errors.related; a row deleted meanwhile → 404 admin.errors.notFound.
   */
  async delete(id: string): Promise<void> {
    await this.database.client.media.delete({ where: { id }, select: { id: true } });
  }
}
