import { Injectable, Logger } from '@nestjs/common';

import type { DependencyState, HealthResponse as HealthResponseContract } from '~shared/contracts/health';

import { MediaStorage } from '~module/storage';
import { Usecase } from '~usecases/usecase.interfaces';

import { DependenciesUnavailableException } from './dependencies-unavailable.exception';
import { HealthDependency } from './health-dependency.enum';
import { HealthRepository } from './health.repository';
import { HealthResponse } from './health.response';

/** Liveness + readiness: the process answers and both the database and the storage respond. */
@Injectable()
export class HealthUsecase implements Usecase<void, HealthResponse> {
  private static readonly OK: HealthResponseContract['status'] = 'ok';
  private static readonly UP: DependencyState = 'up';
  private static readonly DOWN: DependencyState = 'down';
  private readonly logger = new Logger(HealthUsecase.name);

  constructor(
    private readonly repository: HealthRepository,
    private readonly storage: MediaStorage,
  ) {}

  async execute(): Promise<HealthResponse> {
    const [database, storage] = await Promise.all([
      this.checkDependency(HealthDependency.DATABASE, () => this.repository.pingDatabase()),
      this.checkDependency(HealthDependency.STORAGE, () => this.storage.assertAvailable()),
    ]);
    if (database === HealthUsecase.DOWN || storage === HealthUsecase.DOWN) {
      throw new DependenciesUnavailableException({ database, storage });
    }
    return this.buildResponse();
  }

  private buildResponse(): HealthResponse {
    const uptimeSeconds = Math.round(process.uptime());
    const { OK, UP } = HealthUsecase;
    return { status: OK, database: UP, storage: UP, uptimeSeconds, timestamp: new Date().toISOString() };
  }

  private async checkDependency(name: HealthDependency, check: () => Promise<void>): Promise<DependencyState> {
    try {
      await check();
      return HealthUsecase.UP;
    } catch (error: unknown) {
      this.logger.warn('HealthUsecase : dependency is down', {
        dependency: name,
        error: error instanceof Error ? error.message : String(error),
      });
      return HealthUsecase.DOWN;
    }
  }
}
