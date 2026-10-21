import { TriangleAlert } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Suspense, type ReactElement } from 'react';

import { LoginForm } from '@/components/admin/layout/LoginForm';
import { getLoginSessionState } from '@/lib/admin/auth';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { safeAdminPath } from '@/lib/api/session-cookies';

import type { Metadata } from 'next';

/**
 * Reached by redirects (full navigations), never prefetched; renders on request — the session check
 * and the request-time site messages of next-intl block it: no instant-navigation validation.
 */
export const instant = false;

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('auth.title');
}

export default async function LoginPage({ searchParams }: PageProps<'/admin/login'>): Promise<ReactElement> {
  const t = await getTranslations('admin.auth');
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden
            className="block h-6 w-[200px] bg-beige"
            style={{
              maskImage: 'url(/brand/wordmark-ink.svg)',
              WebkitMaskImage: 'url(/brand/wordmark-ink.svg)',
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
            }}
          />
          <h1 className="text-lg font-semibold">{t('heading')}</h1>
        </div>
        <Suspense fallback={<div className="h-32 animate-pulse rounded-md bg-raised" aria-hidden />}>
          <LoginGate searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginGate({ searchParams }: Pick<PageProps<'/admin/login'>, 'searchParams'>): Promise<ReactElement> {
  const [session, params, t] = await Promise.all([getLoginSessionState(), searchParams, getTranslations('admin.auth')]);
  // Post-login target: only /admin paths (never an open redirect).
  const next = safeAdminPath(Array.isArray(params.next) ? params.next[0] : params.next);
  // Already signed in (or the proxy has just refreshed the session) → straight to the admin.
  if (session === 'signedIn') redirect(next);
  return (
    <>
      {session === 'unavailable' ? (
        <div
          role="alert"
          className="mb-6 flex gap-3 rounded-lg border border-yellow-500/30 bg-yellow-400/10 p-4 text-sm text-yellow-100"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-yellow-300" aria-hidden />
          <p>{t('unavailable')}</p>
        </div>
      ) : (
        <p className="-mt-4 mb-6 text-center text-sm text-muted">{t('prompt')}</p>
      )}
      <LoginForm next={next} />
    </>
  );
}
