import { Module } from '@nestjs/common';

import { ImageModule } from '~module/image';
import { MediaStorageModule } from '~module/storage';
import { MediaObjectCleaner } from '~usecases/admin/media/common/media-object.cleaner';
import { MediaAltController } from '~usecases/admin/media/media-alt/patch/media-alt.controller';
import { MediaAltRepository } from '~usecases/admin/media/media-alt/patch/media-alt.repository';
import { MediaAltUsecase } from '~usecases/admin/media/media-alt/patch/media-alt.usecase';
import { MediaDeleteController } from '~usecases/admin/media/media-delete/delete/media-delete.controller';
import { MediaDeleteRepository } from '~usecases/admin/media/media-delete/delete/media-delete.repository';
import { MediaDeleteUsecase } from '~usecases/admin/media/media-delete/delete/media-delete.usecase';
import { MediaDetailsController } from '~usecases/admin/media/media-details/get/media-details.controller';
import { MediaDetailsRepository } from '~usecases/admin/media/media-details/get/media-details.repository';
import { MediaDetailsUsecase } from '~usecases/admin/media/media-details/get/media-details.usecase';
import { MediaUsageCollector } from '~usecases/admin/media/media-details/get/media-usage.collector';
import { MediaListController } from '~usecases/admin/media/media-list/get/media-list.controller';
import { MediaListRepository } from '~usecases/admin/media/media-list/get/media-list.repository';
import { MediaListUsecase } from '~usecases/admin/media/media-list/get/media-list.usecase';
import { MediaUploadController } from '~usecases/admin/media/media-upload/post/media-upload.controller';
import { MediaUploadRepository } from '~usecases/admin/media/media-upload/post/media-upload.repository';
import { MediaUploadUsecase } from '~usecases/admin/media/media-upload/post/media-upload.usecase';

/**
 * Slice S5 (media library): /api/v1/admin/media — upload (multipart → magic bytes → sharp → WebP →
 * storage → Media row), list (cursor + search), details + usages, alt, delete (usage check + object
 * removal). Building blocks: ~module/image, ~module/storage. Every controller: `@Roles([UserRole.ADMIN])`.
 */
@Module({
  imports: [ImageModule, MediaStorageModule],
  controllers: [
    MediaUploadController,
    MediaListController,
    MediaDetailsController,
    MediaAltController,
    MediaDeleteController,
  ],
  providers: [
    MediaObjectCleaner,
    MediaUploadUsecase,
    MediaUploadRepository,
    MediaListUsecase,
    MediaListRepository,
    MediaDetailsUsecase,
    MediaDetailsRepository,
    MediaUsageCollector,
    MediaAltUsecase,
    MediaAltRepository,
    MediaDeleteUsecase,
    MediaDeleteRepository,
  ],
})
export class AdminMediaModule {}
