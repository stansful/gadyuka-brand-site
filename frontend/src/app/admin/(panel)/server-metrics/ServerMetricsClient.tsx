'use client';

import { useEffect, useState } from 'react';

import { ProgressBar } from '@/components/admin/ui/ProgressBar';
import type { ServerMetricsResponse } from '@shared/contracts/server-metrics';

import type { ReactElement } from 'react';

const POLL_INTERVAL_MS = 5000;

export function ServerMetricsClient({
  initialData,
  labels,
}: {
  initialData: ServerMetricsResponse;
  labels: {
    readonly loadAverage: string;
    readonly cores: string;
    readonly usage: string;
    readonly total: string;
    readonly used: string;
    readonly uptime: string;
    readonly diskDevice: string;
    readonly noData: string;
    readonly error: string;
  };
}): ReactElement {
  const [metrics, setMetrics] = useState<ServerMetricsResponse>(initialData);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchMetrics = async (): Promise<void> => {
      try {
        const response = await fetch('/admin/api/server-metrics', { cache: 'no-store', credentials: 'same-origin' });
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data = (await response.json()) as ServerMetricsResponse;
        if (mounted) {
          setMetrics(data);
          setError(false);
        }
      } catch {
        if (mounted) setError(true);
      }
    };

    const interval = setInterval(fetchMetrics, POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {error ? (
        <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 text-sm text-red-fg">{labels.error}</div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <MetricCard title={labels.usage}>
          <div className="mb-3 flex items-end justify-between">
            <span className="text-3xl font-semibold text-fg">
              {metrics.cpu.usagePercent === null ? labels.noData : `${Math.round(metrics.cpu.usagePercent)}%`}
            </span>
            <span className="text-xs text-muted">
              {metrics.cpu.cores} {labels.cores}
            </span>
          </div>
          <ProgressBar
            value={metrics.cpu.usagePercent ?? 0}
            label={`${labels.loadAverage}: ${metrics.cpu.loadAverage1m.toFixed(2)}`}
          />
        </MetricCard>

        <MetricCard title={labels.total}>
          <div className="mb-3 flex items-end justify-between">
            <span className="text-3xl font-semibold text-fg">{formatBytes(metrics.memory.usedBytes)}</span>
            <span className="text-xs text-muted">{formatBytes(metrics.memory.totalBytes)}</span>
          </div>
          <ProgressBar value={metrics.memory.usedPercent} />
          <p className="mt-2 text-xs text-muted">
            {labels.used}: {Math.round(metrics.memory.usedPercent)}%
          </p>
        </MetricCard>
      </section>

      <MetricCard title={labels.diskDevice}>
        <div className="flex flex-col gap-4">
          {metrics.disks.map(disk => (
            <div key={disk.mountpoint}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-fg">{disk.mountpoint}</span>
                <span className="text-xs text-muted">
                  {formatBytes(disk.usedBytes)} / {formatBytes(disk.totalBytes)} ({Math.round(disk.usedPercent)}%)
                </span>
              </div>
              <ProgressBar value={disk.usedPercent} />
            </div>
          ))}
        </div>
      </MetricCard>

      <p className="text-xs text-muted">
        {labels.uptime}: {formatUptime(metrics.uptimeSeconds)}
        {' · '}
        {new Date(metrics.timestamp).toLocaleString('ru-RU')}
      </p>
    </div>
  );
}

function MetricCard({ title, children }: { title: string; children: React.ReactNode }): ReactElement {
  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <h2 className="mb-4 text-sm font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}д`);
  if (hours > 0) parts.push(`${hours}ч`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}мин`);
  return parts.join(' ');
}
