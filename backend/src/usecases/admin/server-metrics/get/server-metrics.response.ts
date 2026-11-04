import { ApiProperty } from '@nestjs/swagger';

class ServerMetricsCpuResponse {
  @ApiProperty({
    description: 'CPU usage percent (0-100), null until a delta can be computed',
    nullable: true,
    type: 'number',
  })
  usagePercent: number | null = null;

  @ApiProperty({ description: '1-minute load average', type: 'number' })
  loadAverage1m = 0;

  @ApiProperty({ description: 'Number of logical CPU cores', type: 'number' })
  cores = 0;
}

class ServerMetricsMemoryResponse {
  @ApiProperty({ description: 'Total RAM in bytes', type: 'number' })
  totalBytes = 0;

  @ApiProperty({ description: 'Used RAM in bytes', type: 'number' })
  usedBytes = 0;

  @ApiProperty({ description: 'Used RAM percent (0-100)', type: 'number' })
  usedPercent = 0;
}

class ServerMetricsDiskResponse {
  @ApiProperty({ description: 'Block device name' })
  device = '';

  @ApiProperty({ description: 'Mount point' })
  mountpoint = '';

  @ApiProperty({ description: 'Total size in bytes', type: 'number' })
  totalBytes = 0;

  @ApiProperty({ description: 'Used size in bytes', type: 'number' })
  usedBytes = 0;

  @ApiProperty({ description: 'Used size percent (0-100)', type: 'number' })
  usedPercent = 0;
}

export class ServerMetricsResponse {
  @ApiProperty({ type: ServerMetricsCpuResponse })
  cpu = new ServerMetricsCpuResponse();

  @ApiProperty({ type: ServerMetricsMemoryResponse })
  memory = new ServerMetricsMemoryResponse();

  @ApiProperty({ type: [ServerMetricsDiskResponse] })
  disks: ServerMetricsDiskResponse[] = [];

  @ApiProperty({ description: 'System uptime in seconds', type: 'number' })
  uptimeSeconds = 0;

  @ApiProperty({ description: 'UTC timestamp of the sample' })
  timestamp = '';
}
