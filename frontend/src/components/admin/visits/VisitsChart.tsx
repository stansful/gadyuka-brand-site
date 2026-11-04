'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState, type ReactElement } from 'react';

import type { VisitsChartType, VisitsGranularity } from './VisitsFilters';

interface Point {
  bucket: string;
  count: number;
}

interface VisitsChartProps {
  points: readonly Point[];
  granularity: VisitsGranularity;
  chartType: VisitsChartType;
  noDataLabel: string;
}

const WIDTH = 800;
const HEIGHT = 320;
const PADDING = { top: 20, right: 20, bottom: 40, left: 48 };

export function VisitsChart({ points, granularity, chartType, noDataLabel }: VisitsChartProps): ReactElement {
  const t = useTranslations('admin.visits');
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);

  const { max, ticks } = useMemo(() => {
    const counts = points.map(p => p.count);
    const top = Math.max(1, ...counts);
    const step = Math.ceil(top / 5) || 1;
    const ceiling = step * 5;
    return { max: ceiling, ticks: Array.from({ length: 6 }, (_, i) => i * step) };
  }, [points]);

  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const xFor = (index: number): number =>
    points.length <= 1 ? PADDING.left + innerWidth / 2 : PADDING.left + (index / (points.length - 1)) * innerWidth;

  const yFor = (count: number): number => PADDING.top + innerHeight - (count / max) * innerHeight;

  const barWidth = points.length > 0 ? Math.min(48, innerWidth / points.length / 2) : 0;

  const labelFor = (bucket: string): string => {
    if (granularity === 'hour') {
      const date = new Date(bucket);
      return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit' });
    }
    const [year, month, day] = bucket.split('-');
    return `${day}.${month}.${year}`;
  };

  if (points.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-line bg-panel text-sm text-muted">
        {noDataLabel}
      </div>
    );
  }

  const linePath = points.map((point, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(point.count)}`).join(' ');

  const areaPath = `${linePath} L ${xFor(points.length - 1)} ${PADDING.top + innerHeight} L ${PADDING.left} ${PADDING.top + innerHeight} Z`;

  return (
    <div className="relative overflow-x-auto rounded-xl border border-line bg-panel p-4">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={t('title')}
        className="min-w-[600px]"
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid lines */}
        {ticks.map(tick => (
          <line
            key={tick}
            x1={PADDING.left}
            y1={yFor(tick)}
            x2={PADDING.left + innerWidth}
            y2={yFor(tick)}
            stroke="currentColor"
            strokeOpacity={0.1}
          />
        ))}

        {/* Y axis labels */}
        {ticks.map(tick => (
          <text
            key={`y-${tick}`}
            x={PADDING.left - 8}
            y={yFor(tick) + 4}
            textAnchor="end"
            className="fill-muted text-[10px]"
          >
            {tick}
          </text>
        ))}

        {/* X axis labels */}
        {points.map((point, i) => (
          <text
            key={`x-${point.bucket}`}
            x={xFor(i)}
            y={PADDING.top + innerHeight + 20}
            textAnchor="middle"
            className="fill-muted text-[10px]"
          >
            {labelFor(point.bucket)}
          </text>
        ))}

        {chartType === 'line' ? (
          <>
            <path d={areaPath} className="fill-beige/10" />
            <path d={linePath} fill="none" stroke="currentColor" strokeWidth={2} className="text-beige" />
            {points.map((point, i) => (
              <circle
                key={i}
                cx={xFor(i)}
                cy={yFor(point.count)}
                r={hover?.index === i ? 6 : 4}
                className="fill-beige"
                onMouseEnter={event =>
                  setHover({ index: i, x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY })
                }
              />
            ))}
          </>
        ) : (
          points.map((point, i) => (
            <rect
              key={i}
              x={xFor(i) - barWidth / 2}
              y={yFor(point.count)}
              width={barWidth}
              height={PADDING.top + innerHeight - yFor(point.count)}
              rx={4}
              className="fill-beige/80"
              onMouseEnter={event => setHover({ index: i, x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY })}
            />
          ))
        )}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-line bg-panel px-2 py-1 text-xs shadow"
          style={{ left: hover.x + 12, top: hover.y - 12 }}
        >
          <span className="font-semibold">{points[hover.index]?.count}</span>
          {(() => {
            const hovered = points[hover.index];
            return hovered ? <> · {labelFor(hovered.bucket)}</> : null;
          })()}
        </div>
      )}
    </div>
  );
}
