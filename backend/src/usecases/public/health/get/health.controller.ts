import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '~decorator';

import { HealthResponse } from './health.response';
import { HEALTH_ROUTE } from './health.route';
import { HealthUsecase } from './health.usecase';

@Controller()
export class HealthController {
  constructor(private readonly usecase: HealthUsecase) {}

  @ApiTags('public')
  @ApiOperation({
    summary: 'Состояние сервиса',
    description: 'Процесс отвечает, база данных и хранилище файлов доступны (для мониторинга и healthcheck).',
  })
  @ApiOkResponse({ type: HealthResponse, description: 'Всё работает' })
  @ApiServiceUnavailableResponse({ description: 'База данных или хранилище недоступны (details: database, storage)' })
  @Public()
  @Get(HEALTH_ROUTE)
  async execute(): Promise<HealthResponse> {
    return this.usecase.execute();
  }
}
