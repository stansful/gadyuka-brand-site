import * as fs from 'node:fs';
import * as os from 'node:os';

import { Injectable, Logger } from '@nestjs/common';

import type { ConfigService } from '~config';
import type { ServerMetricsResponse } from '~shared/contracts/server-metrics';

interface MetricSample {
  readonly name: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly value: number;
}

interface CpuPerCore {
  readonly idle: number;
  readonly total: number;
}

interface CpuSnapshot {
  readonly timestamp: number;
  readonly byCpu: ReadonlyMap<string, CpuPerCore>;
}

interface FilesystemSample {
  device: string;
  fstype: string;
  mountpoint: string;
  size: number;
  avail: number;
}

const DEFAULT_EXPORTER_URL = 'http://node-exporter:9100/metrics';
const FETCH_TIMEOUT_MS = 3000;
const MAX_CPU_SNAPSHOT_AGE_MS = 30_000;

const PSEUDO_FILESYSTEMS = new Set([
  'proc',
  'sysfs',
  'tmpfs',
  'devtmpfs',
  'devpts',
  'cgroup',
  'cgroup2',
  'overlay',
  'squashfs',
  'mqueue',
  'hugetlbfs',
  'pstore',
  'bpf',
  'debugfs',
  'tracefs',
  'fusectl',
  'configfs',
  'efivarfs',
  'rpc_pipefs',
  'autofs',
  'binfmt_misc',
  'securityfs',
  'secfs',
  'ramfs',
]);

const METRIC_LINE_RE = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(?:\s+(\d+))?$/;
const LABEL_RE = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^\\"]|\\.)*)"/g;

/** Data access of the usecase: host metrics via node-exporter with a container-local fallback. */
@Injectable()
export class ServerMetricsRepository {
  private readonly logger = new Logger(ServerMetricsRepository.name);
  private readonly exporterUrl: string;
  private previousCpuSnapshot: CpuSnapshot | null = null;

  constructor(config: ConfigService) {
    this.exporterUrl = config.get('NODE_EXPORTER_URL') ?? DEFAULT_EXPORTER_URL;
  }

  async getMetrics(): Promise<ServerMetricsResponse> {
    try {
      const samples = await this.fetchExporterSamples();
      if (samples.length > 0) {
        return this.buildHostMetrics(samples);
      }
    } catch (error) {
      this.logger.warn({ error }, 'node-exporter is unavailable, falling back to container metrics');
    }

    return this.buildContainerMetrics();
  }

  private async fetchExporterSamples(): Promise<MetricSample[]> {
    const response = await fetch(this.exporterUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`node-exporter responded with ${response.status}`);
    }

    const text = await response.text();
    return this.parseExporterOutput(text);
  }

  private parseExporterOutput(text: string): MetricSample[] {
    const samples: MetricSample[] = [];

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (line === '' || line.startsWith('#')) {
        continue;
      }

      const match = METRIC_LINE_RE.exec(line);
      if (!match) {
        continue;
      }

      const [, name, labelPart, valueText] = match;
      const value = Number.parseFloat(valueText);
      if (!Number.isFinite(value)) {
        continue;
      }

      const labels: Record<string, string> = {};
      if (labelPart) {
        let labelMatch: RegExpExecArray | null;
        while ((labelMatch = LABEL_RE.exec(labelPart)) !== null) {
          labels[labelMatch[1]] = labelMatch[2].replace(/\\(.)/g, '$1');
        }
      }

      samples.push({ name, labels, value });
    }

    return samples;
  }

  private buildHostMetrics(samples: MetricSample[]): ServerMetricsResponse {
    const now = Date.now();
    const cpu = this.buildHostCpu(samples, now);
    const memory = this.buildHostMemory(samples);
    const disks = this.buildHostDisks(samples);
    const uptimeSeconds = this.buildHostUptime(samples, now);

    return {
      cpu,
      memory,
      disks,
      uptimeSeconds,
      timestamp: new Date(now).toISOString(),
    };
  }

  private buildHostCpu(samples: MetricSample[], now: number): ServerMetricsResponse['cpu'] {
    const cpuCounters = new Map<string, Map<string, number>>();

    for (const sample of samples) {
      if (sample.name !== 'node_cpu_seconds_total') {
        continue;
      }
      const cpu = sample.labels.cpu;
      const mode = sample.labels.mode;
      if (cpu === undefined || mode === undefined) {
        continue;
      }

      let modes = cpuCounters.get(cpu);
      if (!modes) {
        modes = new Map<string, number>();
        cpuCounters.set(cpu, modes);
      }
      modes.set(mode, sample.value);
    }

    const byCpu = new Map<string, CpuPerCore>();
    for (const [cpu, modes] of cpuCounters) {
      let idle = 0;
      let total = 0;
      for (const [mode, value] of modes) {
        if (mode === 'idle') {
          idle = value;
        }
        total += value;
      }
      byCpu.set(cpu, { idle, total });
    }

    const cores = byCpu.size;
    const loadSample = samples.find(s => s.name === 'node_load1');
    const loadAverage1m = loadSample?.value ?? 0;

    const currentSnapshot: CpuSnapshot = { timestamp: now, byCpu };
    let usagePercent: number | null = null;

    const previous = this.previousCpuSnapshot;
    if (previous !== null && now - previous.timestamp <= MAX_CPU_SNAPSHOT_AGE_MS) {
      let deltaIdle = 0;
      let deltaTotal = 0;

      for (const [cpu, current] of byCpu) {
        const prior = previous.byCpu.get(cpu);
        if (!prior) {
          continue;
        }
        deltaIdle += current.idle - prior.idle;
        deltaTotal += current.total - prior.total;
      }

      if (deltaTotal > 0) {
        usagePercent = Math.min(100, Math.max(0, 100 * (1 - deltaIdle / deltaTotal)));
      }
    }

    this.previousCpuSnapshot = currentSnapshot;

    return {
      usagePercent,
      loadAverage1m,
      cores,
    };
  }

  private buildHostMemory(samples: MetricSample[]): ServerMetricsResponse['memory'] {
    const totalSample = samples.find(s => s.name === 'node_memory_MemTotal_bytes');
    const availableSample = samples.find(s => s.name === 'node_memory_MemAvailable_bytes');

    const totalBytes = totalSample?.value ?? 0;
    const availableBytes = availableSample?.value ?? totalBytes;
    const usedBytes = Math.max(0, totalBytes - availableBytes);
    const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

    return {
      totalBytes,
      usedBytes,
      usedPercent,
    };
  }

  private buildHostDisks(samples: MetricSample[]): ServerMetricsResponse['disks'] {
    const byKey = new Map<string, FilesystemSample>();

    for (const sample of samples) {
      if (sample.name !== 'node_filesystem_size_bytes' && sample.name !== 'node_filesystem_avail_bytes') {
        continue;
      }

      const device = sample.labels.device ?? '';
      const fstype = sample.labels.fstype ?? '';
      const mountpoint = sample.labels.mountpoint ?? '';

      if (PSEUDO_FILESYSTEMS.has(fstype)) {
        continue;
      }

      const key = `${device}\0${mountpoint}\0${fstype}`;
      let entry = byKey.get(key);
      if (!entry) {
        entry = { device, fstype, mountpoint, size: 0, avail: 0 };
        byKey.set(key, entry);
      }

      if (sample.name === 'node_filesystem_size_bytes') {
        entry.size = sample.value;
      } else {
        entry.avail = sample.value;
      }
    }

    return [...byKey.values()]
      .filter(entry => entry.size > 0)
      .map(entry => {
        const usedBytes = Math.max(0, entry.size - entry.avail);
        return {
          device: entry.device,
          mountpoint: entry.mountpoint,
          totalBytes: entry.size,
          usedBytes,
          usedPercent: (usedBytes / entry.size) * 100,
        };
      })
      .sort((left, right) => left.mountpoint.localeCompare(right.mountpoint));
  }

  private buildHostUptime(samples: MetricSample[], now: number): number {
    const bootSample = samples.find(s => s.name === 'node_boot_time_seconds');
    if (!bootSample || bootSample.value <= 0) {
      return os.uptime();
    }

    return Math.max(0, Math.floor(now / 1000 - bootSample.value));
  }

  private buildContainerMetrics(): ServerMetricsResponse {
    const now = Date.now();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      cpu: {
        usagePercent: null,
        loadAverage1m: os.loadavg()[0] ?? 0,
        cores: os.cpus().length,
      },
      memory: {
        totalBytes: totalMemory,
        usedBytes: usedMemory,
        usedPercent: totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0,
      },
      disks: this.buildContainerDisks(),
      uptimeSeconds: os.uptime(),
      timestamp: new Date(now).toISOString(),
    };
  }

  private buildContainerDisks(): ServerMetricsResponse['disks'] {
    const paths = ['/', process.env.LOG_DIR ?? '/var/log/gadyuka'];
    const uniquePaths = [...new Set(paths)];
    const disks: Array<ServerMetricsResponse['disks'][number]> = [];

    for (const path of uniquePaths) {
      try {
        const stats = fs.statfsSync(path);
        const totalBytes = stats.bsize * stats.blocks;
        const availableBytes = stats.bsize * stats.bavail;
        const usedBytes = Math.max(0, totalBytes - availableBytes);

        disks.push({
          device: path,
          mountpoint: path,
          totalBytes,
          usedBytes,
          usedPercent: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0,
        });
      } catch {
        // Ignore paths that cannot be stat'ed.
      }
    }

    return disks;
  }
}
