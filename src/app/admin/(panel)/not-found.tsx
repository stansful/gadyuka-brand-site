import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { buttonClasses } from '@/components/admin/ui/Button';
import { EmptyState } from '@/components/admin/ui/layout';

import type { ReactElement } from 'react';

export default async function AdminNotFound(): Promise<ReactElement> {
  const t = await getTranslations('admin.notFound');
  return (
    <EmptyState
      title={t('title')}
      description={t('text')}
      action={
        <Link href="/admin" className={buttonClasses('outline', 'sm')}>
          {t('toDashboard')}
        </Link>
      }
    />
  );
}
