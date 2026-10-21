import { Injectable, StreamableFile } from '@nestjs/common';

import { MediaFileServer, MediaKeys } from '~module/storage';
import { Usecase } from '~usecases/usecase.interfaces';

import { MediaFileNotFoundException } from './media-file-not-found.exception';
import { MediaDto } from './media.dto';

/**
 * Serves a media file. Only keys of safe shape ending in a raster image extension are looked up in
 * the bucket (MediaKeys.findServableKey); anything else is a 404 without touching the storage.
 */
@Injectable()
export class MediaUsecase implements Usecase<MediaDto, StreamableFile | undefined> {
  constructor(
    private readonly keys: MediaKeys,
    private readonly server: MediaFileServer,
  ) {}

  async execute({ path, http }: MediaDto): Promise<StreamableFile | undefined> {
    const key = this.keys.findServableKey(path);
    if (key === null) {
      throw new MediaFileNotFoundException();
    }
    return this.server.serve(key, http);
  }
}
