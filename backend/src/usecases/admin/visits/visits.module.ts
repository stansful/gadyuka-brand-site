import { Module } from '@nestjs/common';

import { VisitRepository } from '~usecases/public/content/common/visit.repository';

import { VisitsRecentController } from './recent/get/visits-recent.controller';
import { VisitsRecentUsecase } from './recent/get/visits-recent.usecase';
import { VisitsStatsController } from './stats/get/visits-stats.controller';
import { VisitsStatsUsecase } from './stats/get/visits-stats.usecase';

@Module({
  controllers: [VisitsStatsController, VisitsRecentController],
  providers: [VisitsStatsUsecase, VisitsRecentUsecase, VisitRepository],
})
export class VisitsModule {}
