import { Injectable, Logger } from '@nestjs/common';

import { OriginalFileName } from '~core/media/original-file-name';
import { ImageProcessor } from '~module/image';
import { MediaOwner, MediaStorage } from '~module/storage';
import { MediaItemResponse } from '~usecases/admin/media/common/media-item.response';
import { MediaObjectCleaner } from '~usecases/admin/media/common/media-object.cleaner';
import { MediaRecord } from '~usecases/admin/media/common/media-record';
import { Usecase } from '~usecases/usecase.interfaces';

import { MediaFileMissingException } from './media-file-missing.exception';
import { MediaUploadRepository, NewMedia } from './media-upload.repository';

export interface MediaUploadCommand {
  /** Bytes of the uploaded file; undefined when the request carried none */
  readonly data: Buffer | undefined;
  /** File name on the admin's computer (display only) */
  readonly originalName: string | undefined;
  /** The signed-in admin: the first segments of the storage key and Media.ownerId */
  readonly owner: MediaOwner;
}

/**
 * Upload pipeline (port of createMediaFromUpload of the frontend's media-service.ts): bytes →
 * ImageProcessor (magic bytes, sharp → WebP inside 2400×2400) → storage
 * "<role>/<owner id>/<uuid>/image.webp" → Media row. The stored file is deleted again when the
 * row cannot be written. A file that fails validation is never stored.
 */
@Injectable()
export class MediaUploadUsecase implements Usecase<MediaUploadCommand, MediaItemResponse> {
  private readonly logger = new Logger(MediaUploadUsecase.name);

  constructor(
    private readonly images: ImageProcessor,
    private readonly storage: MediaStorage,
    private readonly repository: MediaUploadRepository,
    private readonly cleaner: MediaObjectCleaner,
  ) {}

  async execute({ data, originalName, owner }: MediaUploadCommand): Promise<MediaItemResponse> {
    const image = await this.images.process(this.requireFile(data));
    const stored = await this.storage.store({ data: image.data, contentType: image.mime }, owner);
    const name = OriginalFileName.fromUpload(originalName ?? '').toString();
    const record = await this.saveOrRemoveFile({ owner, stored, image, originalName: name });
    this.logger.log('MediaUploadUsecase : uploaded', { media_id: record.id, size: record.size });
    return MediaItemResponse.fromRecord(record);
  }

  private requireFile(data: Buffer | undefined): Buffer {
    if (data === undefined) {
      throw new MediaFileMissingException();
    }
    return data;
  }

  /** Writes the row; when that fails, the just stored file is deleted (best effort) and the error rethrown. */
  private async saveOrRemoveFile(media: NewMedia): Promise<MediaRecord> {
    try {
      return await this.repository.create(media);
    } catch (error: unknown) {
      await this.cleaner.remove(media.stored);
      throw error;
    }
  }
}
