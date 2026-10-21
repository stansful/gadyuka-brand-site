import { ApiProperty } from '@nestjs/swagger';

import type { DependencyState, HealthResponse as HealthResponseContract } from '~shared/contracts/health';

export class HealthResponse implements HealthResponseContract {
  @ApiProperty({ enum: ['ok'], description: 'Every dependency answers' })
  status: 'ok';

  @ApiProperty({ enum: ['up', 'down'], description: 'PostgreSQL' })
  database: DependencyState;

  @ApiProperty({ enum: ['up', 'down'], description: 'S3 media storage (MinIO)' })
  storage: DependencyState;

  @ApiProperty({ type: Number, description: 'Seconds since the process started', example: 3600 })
  uptimeSeconds: number;

  @ApiProperty({ type: String, description: 'ISO 8601', example: '2026-10-21T12:00:00.000Z' })
  timestamp: string;
}
