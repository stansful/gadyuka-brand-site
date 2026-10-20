import { notFound } from 'next/navigation';

/** Always 404s, so there is no UI to validate for instant navigation. */
export const instant = false;

/** Unknown /admin/* URLs → the admin 404 (inside the admin chrome, not the site 404). */
export default async function MissingAdminPage({ params }: PageProps<'/admin/[...missing]'>): Promise<never> {
  // Reading params keeps this a request-time render (no prerendered notFound shell).
  await params;
  notFound();
}
