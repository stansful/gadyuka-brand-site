'use client';

import { AdminErrorState } from '@/components/admin/layout/AdminErrorState';

import type { ReactElement } from 'react';

/**
 * Error boundary of the admin pages: a page whose data the backend did not give (readAdminData /
 * readAdminRow throw ApiRequestError) shows this inside the admin frame, so the menu stays usable.
 * A failure of the frame itself (the (panel) layout) goes up to src/app/admin/error.tsx.
 */
export default function AdminPanelError({ error, retry }: { error: unknown; retry: () => void }): ReactElement {
  return <AdminErrorState error={error} retry={retry} />;
}
