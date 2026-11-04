import { Injectable } from '@nestjs/common';

import { Usecase } from '~usecases/usecase.interfaces';

import { ServerMetricsRepository } from './server-metrics.repository';
import { ServerMetricsResponse } from './server-metrics.response';

@Injectable()
export class ServerMetricsUsecase implements Usecase<void, ServerMetricsResponse> {
  constructor(private readonly repository: ServerMetricsRepository) {}

  async execute(): Promise<ServerMetricsResponse> {
    const metrics = await this.repository.getMetrics();
    return Object.assign(new ServerMetricsResponse(), metrics);
  }
}
