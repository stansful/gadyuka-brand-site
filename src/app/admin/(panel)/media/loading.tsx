import { PageSkeleton } from '@/components/admin/ui/layout';

import type { ReactElement } from 'react';

/**
 * Section-level <Suspense> boundary. The pages here read cookies + uncached DB data, so
 * without a boundary below the shared (panel) layout every client navigation into the
 * section would block (Cache Components instant-navigation validation).
 */
export default function SectionLoading(): ReactElement {
  return <PageSkeleton />;
}
