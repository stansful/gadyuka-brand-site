'use client';

import { clsx } from 'clsx';

import type { ReactElement, ReactNode } from 'react';

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label (also the accessible name). */
  label?: ReactNode;
  /** Accessible name when there is no visible label. */
  ariaLabel?: string;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  size?: 'sm' | 'md';
};

export function Switch({
  checked,
  onCheckedChange,
  label,
  ariaLabel,
  description,
  disabled,
  id,
  size = 'md',
}: SwitchProps): ReactElement {
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const thumb = size === 'sm' ? 'size-4' : 'size-5';
  const shift = size === 'sm' ? 'translate-x-4' : 'translate-x-5';

  const control = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={clsx(
        'relative inline-flex shrink-0 items-center rounded-full border transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-beige disabled:cursor-not-allowed disabled:opacity-50',
        track,
        checked ? 'border-beige bg-beige' : 'border-line-strong bg-raised-hi',
      )}
    >
      <span
        aria-hidden
        className={clsx(
          'inline-block rounded-full shadow transition-transform',
          thumb,
          checked ? clsx(shift, 'bg-ink') : 'translate-x-0.5 bg-muted',
        )}
      />
    </button>
  );

  if (!label) return control;
  return (
    <label className={clsx('flex items-start gap-3', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
      {control}
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-fg">{label}</span>
        {description ? <span className="text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
