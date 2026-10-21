import 'server-only';
import { ApiRequestError, type ApiFailure } from '@/lib/api/api-result';
import { apiRequest, type ApiPath, type ApiQueryValue } from '@/lib/api/client';

/**
 * Backend reads of the content layer's own "use cache" functions (./landing.ts), which choose their
 * cacheLife themselves — the landing shortens it before an offer ends, so its read must not sit in
 * a nested cache that lives longer (src/lib/api/public.ts → cachedPublicRead keeps the "hours"
 * profile). No request-time API in here: callable inside "use cache"; the callers pass connection()
 * first. A failure throws ApiRequestError and is never cached.
 */

type Query = Readonly<Record<string, ApiQueryValue>>;

/** The answer of `path`; throws ApiRequestError when the backend cannot answer it. */
export async function readPublicData<T>(path: ApiPath, query?: Query): Promise<T> {
  const result = await apiRequest<T>(path, { query });
  if (!result.ok) throw new ApiRequestError(path, result.failure);
  return result.data;
}

/**
 * Like readPublicData, but null when the requested row does not exist: the backend answers 404, or
 * refuses the address as one that cannot exist (400 — a malformed slug from the URL).
 */
export async function findPublicData<T>(path: ApiPath, query?: Query): Promise<T | null> {
  const result = await apiRequest<T>(path, { query });
  if (result.ok) return result.data;
  if (isMissing(result.failure)) return null;
  throw new ApiRequestError(path, result.failure);
}

function isMissing(failure: ApiFailure): boolean {
  return failure.kind === 'validation' || (failure.kind === 'domain' && failure.status === 404);
}
