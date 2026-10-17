import type { ReactElement } from "react";
import { PageSkeleton } from "@/components/admin/ui/layout";

/**
 * <Suspense> boundary for this page: it reads cookies + uncached DB data, so navigations
 * from the section list (shared segment) would otherwise block (instant-navigation validation).
 */
export default function PageLoading(): ReactElement {
  return <PageSkeleton />;
}
