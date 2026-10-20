'use client';

import { useTranslations } from 'next-intl';
import { Toaster } from 'sonner';

import type { ReactElement } from 'react';

/** Toast host for the admin (sonner): labels from admin.ui, dark theme. */
export function AdminToaster(): ReactElement {
  const t = useTranslations('admin.ui');
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      richColors
      closeButton
      duration={4000}
      containerAriaLabel={t('toasts')}
      toastOptions={{
        style: { fontFamily: 'var(--font-sans)' },
        closeButtonAriaLabel: t('closeToast'),
      }}
    />
  );
}
