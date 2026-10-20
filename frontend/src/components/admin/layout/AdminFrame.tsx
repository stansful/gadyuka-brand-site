import { TriangleAlert } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { requireAdminPage } from '@/lib/admin/auth';
import { getNewLeadCount } from '@/lib/admin/queries';
import { isTelegramDryRun } from '@/lib/telegram';

import type { ReactElement, ReactNode } from 'react';

import { AdminSidebar } from './AdminSidebar';

/**
 * Authenticated admin chrome (rendered inside <Suspense> by the (panel) layout):
 * checks access (→ /admin/login), shows the sidebar and warnings: «admin is open» (no
 * ADMIN_PASSWORD) and, in production, «Telegram is in dry-run mode» (leads are not sent).
 * Pages re-check access themselves via src/lib/admin/queries.ts.
 */
export async function AdminFrame({ children }: { children: ReactNode }): Promise<ReactElement> {
  const access = await requireAdminPage();
  const [newLeads, t] = await Promise.all([getNewLeadCount(), getTranslations('admin.frame')]);
  const telegramDryRunInProduction = process.env.NODE_ENV === 'production' && isTelegramDryRun();

  return (
    <div className="min-h-dvh">
      <AdminSidebar newLeads={newLeads} canLogout={access.mode === 'password'} />
      <div className="lg:pl-60">
        {access.mode === 'open' ? (
          <div
            role="note"
            className="flex items-center gap-2 border-b border-yellow-500/30 bg-yellow-400/10 px-4 py-2 text-xs text-yellow-200 md:px-6 lg:px-8"
          >
            <TriangleAlert className="size-4 shrink-0 text-yellow-300" aria-hidden />
            <span>
              {t.rich('openAdmin', { code: chunks => <code className="font-mono text-yellow-100">{chunks}</code> })}
            </span>
          </div>
        ) : null}
        {telegramDryRunInProduction ? (
          <div
            role="note"
            className="flex items-center gap-2 border-b border-yellow-500/30 bg-yellow-400/10 px-4 py-2 text-xs text-yellow-200 md:px-6 lg:px-8"
          >
            <TriangleAlert className="size-4 shrink-0 text-yellow-300" aria-hidden />
            <span>
              {t.rich('telegramDryRun', {
                code: chunks => <code className="font-mono text-yellow-100">{chunks}</code>,
              })}
            </span>
          </div>
        ) : null}
        <main id="admin-main" className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Static fallback while the frame (auth + sidebar) streams in. */
export async function AdminFrameFallback(): Promise<ReactElement> {
  const t = await getTranslations('admin.frame');
  return (
    <div className="min-h-dvh" role="status" aria-live="polite">
      <span className="sr-only">{t('loading')}</span>
      <div className="fixed inset-y-0 left-0 hidden w-60 border-r border-line bg-panel lg:block" />
      <div className="h-14 border-b border-line bg-panel lg:hidden" />
      <div className="lg:pl-60">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-8 md:px-6 lg:px-8">
          <div className="h-7 w-56 animate-pulse rounded-md bg-raised-hi" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-raised-hi" />
          <div className="mt-4 h-40 w-full animate-pulse rounded-xl bg-raised" />
        </div>
      </div>
    </div>
  );
}
