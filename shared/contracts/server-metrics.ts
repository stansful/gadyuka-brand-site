export interface ServerMetricsCpu {
  readonly usagePercent: number | null;
  readonly loadAverage1m: number;
  readonly cores: number;
}

export interface ServerMetricsMemory {
  readonly totalBytes: number;
  readonly usedBytes: number;
  readonly usedPercent: number;
}

export interface ServerMetricsDisk {
  readonly device: string;
  readonly mountpoint: string;
  readonly totalBytes: number;
  readonly usedBytes: number;
  readonly usedPercent: number;
}

export interface ServerMetricsResponse {
  readonly cpu: ServerMetricsCpu;
  readonly memory: ServerMetricsMemory;
  readonly disks: readonly ServerMetricsDisk[];
  readonly uptimeSeconds: number;
  readonly timestamp: string;
}
