import { createTranslator, NextIntlClientProvider } from 'next-intl';
import { Montserrat } from 'next/font/google';

import { AdminToaster } from '@/components/admin/ui/AdminToaster';
import { ADMIN_LOCALE } from '@/lib/admin/i18n';
import adminRu from '@shared/messages/admin/ru.json';

import type { Metadata, Viewport } from 'next';
import type { ReactElement, ReactNode } from 'react';

import './admin.css';

/**
 * Root layout of the admin (/admin/**). Separate from the site root layout
 * (src/app/[locale]/layout.tsx): Russian only, own stylesheet (Tailwind), never indexed.
 * Access control lives in (panel)/layout.tsx + every query/action (src/lib/admin/auth.ts).
 *
 * UI copy: shared/messages/admin/ru.json (src/lib/admin/i18n.ts). The client provider gets ONLY the
 * "admin" namespace — the site messages never reach the admin's browser bundle. The layout takes
 * that static file directly instead of getMessages() / getTranslations(): those also load the
 * DB-backed site messages, which the admin shell (/admin/login included) has no use for.
 */

const adminFont = Montserrat({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-admin',
  display: 'swap',
});

/** The admin reads cookies and the backend on every request; navigations may block. */
export const instant = false;

const metaText = createTranslator({ locale: ADMIN_LOCALE, messages: adminRu, namespace: 'admin.meta' });

export const metadata: Metadata = {
  title: { default: metaText('default'), template: metaText('template') },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export const viewport: Viewport = {
  themeColor: '#010101',
  colorScheme: 'dark',
};

export default function AdminRootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang={ADMIN_LOCALE} className={adminFont.variable}>
      <body className="min-h-dvh bg-ink text-fg antialiased">
        <NextIntlClientProvider locale={ADMIN_LOCALE} messages={{ admin: adminRu.admin }}>
          {children}
          <AdminToaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
