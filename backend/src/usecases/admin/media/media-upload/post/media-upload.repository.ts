import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';
import { ProcessedImage } from '~module/image';
import { MediaOwner, StoredMedia } from '~module/storage';
import { Prisma } from '~prisma-generated/prisma/client';
import { MediaRecord } from '~usecases/admin/media/common/media-record';
import { MediaRecordMapper } from '~usecases/admin/media/common/media-record.mapper';

/** A stored upload, ready for its Media row. */
export interface NewMedia {
  readonly owner: MediaOwner;
  readonly stored: StoredMedia;
  readonly image: ProcessedImage;
  /** Sanitized display name of the uploaded file */
  readonly originalName: string;
}

@Injectable()
export class MediaUploadRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(media: NewMedia): Promise<MediaRecord> {
    const row = await this.database.client.media.create({ data: this.toData(media), select: MediaRecordMapper.SELECT });
    return MediaRecordMapper.toRecord(row);
  }

  /** Owner + location (uuid, bucket, key, url) + image metadata; no alt text yet. */
  private toData({ owner, stored, image, originalName }: NewMedia): Prisma.MediaUncheckedCreateInput {
    const { mime, width, height, size } = image;
    return { ...owner, ...stored, mime, width, height, size, alt: {}, originalName };
  }
}
