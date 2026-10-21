import 'server-only';
import type { ApiPath, ApiRequestOptions } from './client';

import { adminRequest } from './admin';
import { ApiRequestError, type ApiFailure } from './api-result';

/**
 * The reads of the admin pages (after requireAdminPage): the backend's answer as is.
 *
 *   const list = await readAdminData<AdminCollectionListResponse>('/api/v1/admin/collections');
 *   const row = await readAdminRow<AdminCollectionDetailsResponse>(`/api/v1/admin/collections/${id}`);
 *   if (!row) notFound();
 */

/**
 * Data of an admin page; a failure throws ApiRequestError (the admin's error page shows:
 * src/app/admin/(panel)/error.tsx).
 */
export async function readAdminData<T>(path: ApiPath, options?: Pick<ApiRequestOptions, 'query'>): Promise<T> {
  const result = await (options ? adminRequest<T>(path, options) : adminRequest<T>(path));
  if (!result.ok) throw new ApiRequestError(path, result.failure);
  return result.data;
}

/**
 * One row of an edit / detail page: null when there is no such row — unknown (404) or a malformed id
 * (400: admin.errors.invalidId, or a validation error of the id) — so the page answers notFound().
 * Any other failure throws ApiRequestError.
 */
export async function readAdminRow<T>(path: ApiPath): Promise<T | null> {
  const result = await adminRequest<T>(path);
  if (result.ok) return result.data;
  if (isMissingRow(result.failure)) return null;
  throw new ApiRequestError(path, result.failure);
}

function isMissingRow(failure: ApiFailure): boolean {
  if (failure.kind === 'validation') return true;
  return failure.kind === 'domain' && (failure.status === 404 || failure.status === 400);
}
