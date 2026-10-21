import type { ApiErrorCode, MessageRef } from '@shared/contracts/errors';

/**
 * Results of backend calls (isomorphic types). Mirrors the error bodies of the backend
 * (shared/contracts/errors.ts, backend/src/exception):
 * - `validation`: 400 { error: 'validation', fields: { "<dotted path>": { key, values } } };
 * - `domain`: any other error body { statusCode, error, key, values?, details? } — `message` is the
 *   message key (+ ICU values) of shared/messages the frontend translates;
 * - `unavailable`: no usable answer — the backend is down / unreachable / timed out, answered
 *   something that is not one of its error bodies, or BACKEND_URL / INTERNAL_API_KEY are missing.
 */
export type ApiFailure =
  | {
      readonly kind: 'validation';
      readonly status: number;
      readonly fields: Readonly<Record<string, MessageRef>>;
    }
  | {
      readonly kind: 'domain';
      readonly status: number;
      readonly error: ApiErrorCode;
      readonly message: MessageRef;
      readonly details?: Readonly<Record<string, string | number | boolean>>;
    }
  | {
      readonly kind: 'unavailable';
      /** HTTP status of an unusable answer; null when there was none */
      readonly status: number | null;
      readonly reason: 'network' | 'timeout' | 'badResponse' | 'config';
    };

export type ApiResult<T> =
  | { readonly ok: true; readonly status: number; readonly data: T }
  | { readonly ok: false; readonly failure: ApiFailure };

/** Thrown by the throwing helpers (cached public reads): the failure of `path`. */
export class ApiRequestError extends Error {
  constructor(
    readonly path: string,
    readonly failure: ApiFailure,
  ) {
    super(`Backend request ${path} failed: ${describeFailure(failure)}`);
    this.name = 'ApiRequestError';
  }
}

/** First status of a failure on the backend's own side. */
const SERVER_ERROR_STATUS = 500;

/**
 * A write may have landed or not: the request may have reached the backend, but no usable answer
 * came back (timeout, a reset connection, a proxy's error page — only a missing configuration means
 * nothing was sent), or the backend failed on its own side (5xx) and cannot say what was written.
 */
export function isOutcomeUnknown(failure: ApiFailure): boolean {
  if (failure.kind === 'unavailable') return failure.reason !== 'config';
  return failure.kind === 'domain' && failure.status >= SERVER_ERROR_STATUS;
}

/** One line for logs (no user data: kind, status, code / reason). */
export function describeFailure(failure: ApiFailure): string {
  switch (failure.kind) {
    case 'validation':
      return `validation (${Object.keys(failure.fields).join(', ')})`;
    case 'domain':
      return `${failure.status} ${failure.error} (${failure.message.key})`;
    case 'unavailable':
      return `unavailable: ${failure.reason}${failure.status === null ? '' : ` (${failure.status})`}`;
  }
}
