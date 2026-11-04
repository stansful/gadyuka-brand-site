import { Module } from '@nestjs/common';

import { ServerMetricsController } from './get/server-metrics.controller';
import { ServerMetricsRepository } from './get/server-metrics.repository';
import { ServerMetricsUsecase } from './get/server-metrics.usecase';

@Module({
  controllers: [ServerMetricsController],
  providers: [ServerMetricsUsecase, ServerMetricsRepository],
})
export class ServerMetricsModule {}
