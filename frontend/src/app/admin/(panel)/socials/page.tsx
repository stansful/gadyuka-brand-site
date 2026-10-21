import { Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { EntityList } from '@/components/admin/lists/EntityList';
import { buttonClasses } from '@/components/admin/ui/Button';
import { PageHeader } from '@/components/admin/ui/layout';
import { adminPageMetadata } from '@/lib/admin/i18n-server';
import { listSocialLinksAdmin } from '@/lib/admin/queries/content';

import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function generateMetadata(): Promise<Metadata> {
  return adminPageMetadata('socials.title');
}

export default async function ListPage(): Promise<ReactElement> {
  const [rows, t] = await Promise.all([listSocialLinksAdmin(), getTranslations('admin.socials')]);
  const addLink = (
    <Link href="/admin/socials/new" className={buttonClasses('primary')}>
      <Plus className="size-4" aria-hidden />
      {t('add')}
    </Link>
  );
  return (
    <>
      <PageHeader title={t('title')} description={t('description')} actions={<>{addLink}</>} />
      <EntityList
        entity="socialLink"
        rows={rows}
        withMedia={false}
        empty={{
          title: t('empty'),
          description: t('emptyHint'),
          action: addLink,
        }}
      />
    </>
  );
}
