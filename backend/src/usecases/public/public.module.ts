import { Module } from '@nestjs/common';

import { MediaStorageModule } from '~module/storage';
import { PublicContentModule } from '~usecases/public/content/content.module';
import { HealthController } from '~usecases/public/health/get/health.controller';
import { HealthRepository } from '~usecases/public/health/get/health.repository';
import { HealthUsecase } from '~usecases/public/health/get/health.usecase';
import { LeadsModule } from '~usecases/public/leads/leads.module';
import { MediaController } from '~usecases/public/media/get/media.controller';
import { MediaUsecase } from '~usecases/public/media/get/media.usecase';

/**
 * The public API (/api/v1/public/*, every route @Public) and the media files (/media/*). Slices own
 * their feature modules (content, leads) and register their usecases there, never here.
 */
@Module({
  imports: [MediaStorageModule, PublicContentModule, LeadsModule],
  controllers: [HealthController, MediaController],
  providers: [HealthUsecase, HealthRepository, MediaUsecase],
})
export class PublicModule {}
