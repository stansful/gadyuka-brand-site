import { Suspense, type ReactElement, type ReactNode } from 'react';

import { AdminFrame, AdminFrameFallback } from '@/components/admin/layout/AdminFrame';

/**
 * Authenticated part of the admin. The access check reads cookies (request-time), so the
 * frame streams in behind <Suspense>; every page re-checks access in its data queries.
 */
export default function PanelLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <Suspense fallback={<AdminFrameFallback />}>
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}
