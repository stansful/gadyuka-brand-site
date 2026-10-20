import { clsx } from 'clsx';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import type { ReactElement, ReactNode } from 'react';

/**
 * Shared admin layout pieces (Server and Client Components: copy via useTranslations, which
 * works in both — never call them from an async component's body, only render them).
 */

/** Page title row: optional back link («Назад» by default), title, description, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}): ReactElement {
  const t = useTranslations('admin.ui');
  return (
    <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-beige"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            {backLabel ?? t('back')}
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Bordered panel with an optional heading. */
export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}): ReactElement {
  return (
    <section className={clsx('rounded-xl border border-line bg-panel', className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            {title ? <h2 className="text-sm font-semibold text-fg">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={clsx('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export type BadgeTone = 'neutral' | 'beige' | 'blue' | 'red' | 'outline';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-raised-hi text-muted',
  beige: 'bg-beige/15 text-beige',
  blue: 'bg-blue text-blue-fg',
  red: 'bg-red/20 text-red-fg',
  outline: 'border border-line-strong text-muted',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  title,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  title?: string;
}): ReactElement {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Friendly placeholder for empty lists. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-panel/60 px-6 py-14 text-center">
      {icon ? <div className="text-muted [&>svg]:size-8">{icon}</div> : null}
      <div>
        <p className="text-sm font-semibold text-fg">{title}</p>
        {description ? <p className="mt-1 max-w-md text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }): ReactElement {
  return <div aria-hidden className={clsx('animate-pulse rounded-md bg-raised-hi', className)} />;
}

/** Generic page skeleton (loading.tsx). */
export function PageSkeleton({ rows = 6 }: { rows?: number }): ReactElement {
  const t = useTranslations('admin.ui');
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">{t('loading')}</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
