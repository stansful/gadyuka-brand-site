import { clsx } from 'clsx';

import type { ReactElement } from 'react';

export function ProgressBar({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}): ReactElement {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div className={clsx('w-full', className)}>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-raised-hi">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-500 ease-out',
            percent >= 90 ? 'bg-red' : percent >= 70 ? 'bg-beige' : 'bg-beige/80',
          )}
          style={{ width: `${percent}%` }}
          aria-hidden
        />
      </div>
      {label ? <p className="mt-1.5 text-xs text-muted">{label}</p> : null}
    </div>
  );
}
