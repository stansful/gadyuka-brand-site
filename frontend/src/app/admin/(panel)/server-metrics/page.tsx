import { getTranslations } from 'next-intl/server';

import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { getServerMetrics } from '@/lib/admin/queries/server-metrics';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { ServerMetricsClient } from './ServerMetricsClient';

export async function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('serverMetrics.title');
}

export default async function ServerMetricsPage(): Promise<ReactElement> {
  const [data, t] = await Promise.all([getServerMetrics(), getTranslations('admin.serverMetrics')]);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <ServerMetricsClient
        initialData={data}
        labels={{
          loadAverage: t('loadAverage'),
          cores: t('cores'),
          usage: t('cpu'),
          total: t('memory'),
          used: t('used'),
          uptime: t('uptime'),
          diskDevice: t('disk'),
          noData: t('noData'),
          error: t('error'),
        }}
      />
    </>
  );
}
