import { ok, strictEqual } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import type { ConfigService } from '~config';

import { ServerMetricsRepository } from './server-metrics.repository';

function createConfig(url?: string): ConfigService {
  return { get: (key: string) => (key === 'NODE_EXPORTER_URL' ? url : undefined) } as unknown as ConfigService;
}

describe('ServerMetricsRepository', () => {
  let repository: ServerMetricsRepository;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    repository = new ServerMetricsRepository(createConfig());
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parses node-exporter output and returns host metrics', async () => {
    global.fetch = async () =>
      ({
        ok: true,
        status: 200,
        text: async () => prometheusOutput(),
      }) as Response;

    const first = await repository.getMetrics();
    strictEqual(first.cpu.cores, 2);
    strictEqual(first.cpu.loadAverage1m, 0.42);
    strictEqual(first.cpu.usagePercent, null);
    strictEqual(first.memory.totalBytes, 8_000_000_000);
    strictEqual(first.memory.usedBytes, 3_000_000_000);
    ok(first.disks.length >= 1);

    const rootDisk = first.disks.find(d => d.mountpoint === '/');
    ok(rootDisk);
    strictEqual(rootDisk.totalBytes, 100_000_000_000);
    strictEqual(rootDisk.usedBytes, 30_000_000_000);

    // Second call with shifted counters yields a CPU usage percent.
    global.fetch = async () =>
      ({
        ok: true,
        status: 200,
        text: async () => prometheusOutput({ cpuShiftSeconds: 1 }),
      }) as Response;

    const second = await repository.getMetrics();
    strictEqual(second.cpu.usagePercent, 50);
  });

  it('falls back to container metrics when node-exporter is unreachable', async () => {
    global.fetch = async () => {
      throw new Error('connection refused');
    };

    const metrics = await repository.getMetrics();
    ok(metrics.cpu.cores >= 1);
    ok(metrics.memory.totalBytes > 0);
    ok(metrics.disks.length >= 1);
    ok(metrics.uptimeSeconds >= 0);
  });

  it('falls back when node-exporter returns non-200', async () => {
    global.fetch = async () =>
      ({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      }) as Response;

    const metrics = await repository.getMetrics();
    ok(metrics.cpu.cores >= 1);
    ok(metrics.memory.totalBytes > 0);
  });
});

function prometheusOutput(options: { readonly cpuShiftSeconds?: number } = {}): string {
  const shift = options.cpuShiftSeconds ?? 0;
  return `
# HELP node_cpu_seconds_total Seconds the CPUs spent in each mode.
# TYPE node_cpu_seconds_total counter
node_cpu_seconds_total{cpu="0",mode="idle"} ${100 + shift}
node_cpu_seconds_total{cpu="0",mode="user"} ${50 + shift}
node_cpu_seconds_total{cpu="0",mode="system"} 30
node_cpu_seconds_total{cpu="0",mode="iowait"} 10
node_cpu_seconds_total{cpu="1",mode="idle"} ${200 + shift}
node_cpu_seconds_total{cpu="1",mode="user"} ${60 + shift}
node_cpu_seconds_total{cpu="1",mode="system"} 40
# HELP node_load1 1m load average.
# TYPE node_load1 gauge
node_load1 0.42
# HELP node_memory_MemTotal_bytes Total memory.
# TYPE node_memory_MemTotal_bytes gauge
node_memory_MemTotal_bytes 8000000000
# HELP node_memory_MemAvailable_bytes Available memory.
# TYPE node_memory_MemAvailable_bytes gauge
node_memory_MemAvailable_bytes 5000000000
# HELP node_filesystem_size_bytes Filesystem size in bytes.
# TYPE node_filesystem_size_bytes gauge
node_filesystem_size_bytes{device="/dev/sda1",fstype="ext4",mountpoint="/"} 100000000000
node_filesystem_size_bytes{device="tmpfs",fstype="tmpfs",mountpoint="/run"} 1000000000
# HELP node_filesystem_avail_bytes Filesystem available space in bytes.
# TYPE node_filesystem_avail_bytes gauge
node_filesystem_avail_bytes{device="/dev/sda1",fstype="ext4",mountpoint="/"} 70000000000
node_filesystem_avail_bytes{device="tmpfs",fstype="tmpfs",mountpoint="/run"} 900000000
# HELP node_boot_time_seconds Node boot time, in unixtime.
# TYPE node_boot_time_seconds gauge
node_boot_time_seconds 1600000000
`.trim();
}
