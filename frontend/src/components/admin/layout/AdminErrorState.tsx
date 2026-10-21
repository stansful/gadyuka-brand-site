'use client';

import { RefreshCw, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, type ReactElement } from 'react';

import { ADMIN_LOGIN_PATH } from '@/lib/api/session-cookies';

import { Button, buttonClasses } from '../ui/Button';
import { EmptyState } from '../ui/layout';

/**
 * Body of the admin error boundaries (src/app/admin/error.tsx, src/app/admin/(panel)/error.tsx):
 * mostly the backend not answering (down, a 5xx, a timeout) while the admin works. «Попробовать
 * снова» re-renders the failed segment (retry); `loginLink` adds «Ко входу» where there is no menu
 * (the login page shows its form even while the backend is down).
 */
export function AdminErrorState({
  error,
  retry,
  loginLink = false,
}: {
  error: unknown;
  retry: () => void;
  loginLink?: boolean;
}): ReactElement {
  const t = useTranslations('admin.errorPage');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert">
      <EmptyState
        icon={<TriangleAlert aria-hidden />}
        title={t('title')}
        description={t('text')}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<RefreshCw className="size-4" aria-hidden />}
              onClick={() => retry()}
            >
              {t('retry')}
            </Button>
            {loginLink ? (
              <Link href={ADMIN_LOGIN_PATH} className={buttonClasses('outline', 'sm')}>
                {t('toLogin')}
              </Link>
            ) : null}
          </div>
        }
      />
    </div>
  );
}
