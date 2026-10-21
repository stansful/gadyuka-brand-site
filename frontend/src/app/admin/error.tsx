'use client';

import { AdminErrorState } from '@/components/admin/layout/AdminErrorState';

import type { ReactElement } from 'react';

/**
 * Error boundary of the whole admin. app/admin/layout.tsx is a root layout (its own <html>), so this
 * is the last boundary before Next's built-in English page: it wraps the (panel) layout — AdminFrame's
 * session check, which throws while the backend is down or answers 5xx — and /admin/login. Rendered
 * inside the admin root layout (its NextIntlClientProvider gives the copy).
 */
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }): ReactElement {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <AdminErrorState error={error} retry={retry} loginLink />
      </div>
    </main>
  );
}
