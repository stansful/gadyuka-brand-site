import { Module } from '@nestjs/common';
import { StorageModule } from '@nestjs/storage';

import { MediaFileServer } from './media-file.server';
import { MediaKeys } from './media-keys';
import { MediaStorage } from './media-storage';
import { MediaStorageOptionsFactory } from './media-storage-options.factory';

@Module({
  imports: [StorageModule.forRootAsync({ useClass: MediaStorageOptionsFactory })],
  providers: [MediaKeys, MediaStorage, MediaFileServer],
  exports: [MediaKeys, MediaStorage, MediaFileServer],
})
export class MediaStorageModule {}
