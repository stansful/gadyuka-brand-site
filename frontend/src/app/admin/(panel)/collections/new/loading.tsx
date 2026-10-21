import { PageSkeleton } from '@/components/admin/ui/layout';

import type { ReactElement } from 'react';

/**
 * <Suspense> boundary for this page: it checks the admin session with the backend (GET /auth/me) on
 * every request, so navigations from the section list (shared segment) would otherwise block
 * (instant-navigation validation).
 */
export default function PageLoading(): ReactElement {
  return <PageSkeleton />;
}
