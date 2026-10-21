import { PageSkeleton } from '@/components/admin/ui/layout';

import type { ReactElement } from 'react';

/**
 * <Suspense> boundary for this page: it reads cookies + uncached backend data, so navigations
 * from the section list (shared segment) would otherwise block (instant-navigation validation).
 */
export default function PageLoading(): ReactElement {
  return <PageSkeleton />;
}
