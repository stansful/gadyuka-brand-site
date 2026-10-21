import { Module } from '@nestjs/common';

import { PickedMediaChecker } from './media/picked-media.checker';
import { PickedMediaRepository } from './media/picked-media.repository';

/**
 * Helpers several admin areas share (catalog, content entities): the check of picked media files. The
 * rest of ./ is stateless (RowIdPipe, MediaRefRecord / MediaRefResponse, LocalizedTextField …) and
 * imported directly.
 */
@Module({
  providers: [PickedMediaRepository, PickedMediaChecker],
  exports: [PickedMediaChecker],
})
export class AdminCommonModule {}
