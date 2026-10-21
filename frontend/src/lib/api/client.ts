import type { ApiErrorCode, MessageRef } from '@shared/contracts/errors';
import type { ApiRequestHeader, ApiRequestTimeoutMs } from '@shared/contracts/http';

import { type ApiFailure, type ApiResult } from './api-result';
import { readBackendEnv } from './backend-env';

/**
 * The one way this server talks to the backend: fetch to `${BACKEND_URL}${path}` with
 * x-internal-key (every request), and — when given — the visitor's IP and user agent and the admin's
 * access token (headers: shared/contracts/http.ts ApiRequestHeader). Never throws for an HTTP or network failure: the result says what happened
 * (./api-result.ts). No request-time APIs in here (usable inside "use cache" and by src/proxy.ts):
 * the visitor comes from ./visitor.ts, the access token from ./admin.ts.
 */

/** Backend routes live under /api/v1 (GET|HEAD /media/* is proxied separately, src/app/media). */
export type ApiPath = `/api/v1/${string}`;

export type ApiMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Who the request is made for (forwarded as x-client-ip / x-client-user-agent: rate limits, sessions, lead metadata). */
export type VisitorInfo = {
  readonly clientIp: string | null;
  readonly userAgent: string | null;
};

export type ApiQueryValue = string | number | boolean | null | undefined;

export type ApiRequestOptions = {
  readonly method?: ApiMethod;
  /** Sent as JSON */
  readonly body?: unknown;
  /** Sent as multipart/form-data (uploads); mutually exclusive with `body` */
  readonly formData?: FormData;
  /** Appended as ?name=value (null / undefined values are left out) */
  readonly query?: Readonly<Record<string, ApiQueryValue>>;
  /** `Authorization: Bearer …` (admin routes, /auth/me) */
  readonly accessToken?: string;
  readonly visitor?: VisitorInfo;
  readonly signal?: AbortSignal;
  /**
   * Default: the contract's ApiRequestTimeoutMs (10 s; the backend keeps a request's budgets below it).
   * A route that may take longer says so in its contract (leads.ts LeadResendTimeoutMs); uploads pass more.
   */
  readonly timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS: ApiRequestTimeoutMs = 10_000;
const CLIENT_IP_HEADER = 'x-client-ip' satisfies ApiRequestHeader;
const CLIENT_USER_AGENT_HEADER = 'x-client-user-agent' satisfies ApiRequestHeader;
const NO_BODY_STATUSES = new Set([204, 205, 304]);

let configProblemLogged = false;

export async function apiRequest<T>(path: ApiPath, options: ApiRequestOptions = {}): Promise<ApiResult<T>> {
  const config = readBackendEnv();
  if (!config.ok) {
    if (!configProblemLogged) console.error(`[api] backend not configured: ${config.problem}`);
    configProblemLogged = true;
    return { ok: false, failure: { kind: 'unavailable', status: null, reason: 'config' } };
  }
  const method = options.method ?? 'GET';
  let response: Response;
  try {
    response = await fetch(urlOf(config.env.backendUrl, path, options.query), {
      method,
      headers: headersOf(config.env.internalKey, options),
      body: bodyOf(options),
      signal: signalOf(options),
      redirect: 'manual',
    });
  } catch (error: unknown) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network';
    return { ok: false, failure: { kind: 'unavailable', status: null, reason } };
  }
  return readResponse<T>(response, method);
}

function urlOf(origin: string, path: ApiPath, query: ApiRequestOptions['query']): string {
  const url = new URL(path, origin);
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined) url.searchParams.set(name, String(value));
  }
  return url.toString();
}

function headersOf(internalKey: string, options: ApiRequestOptions): Headers {
  const headers = new Headers({ accept: 'application/json', 'x-internal-key': internalKey });
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  if (options.accessToken) headers.set('authorization', `Bearer ${options.accessToken}`);
  if (options.visitor) setVisitorHeaders(headers, options.visitor);
  return headers;
}

/**
 * The visitor's IP and User-Agent, each only when known. The User-Agent travels in its own header:
 * the request's `user-agent` is this server's HTTP client (Node's fetch sends "node" when none is
 * set), which the backend must never store as the visitor's browser.
 */
export function setVisitorHeaders(headers: Headers, visitor: VisitorInfo): void {
  if (visitor.clientIp) headers.set(CLIENT_IP_HEADER, visitor.clientIp);
  if (visitor.userAgent) headers.set(CLIENT_USER_AGENT_HEADER, visitor.userAgent);
}

function bodyOf(options: ApiRequestOptions): BodyInit | undefined {
  if (options.formData) return options.formData;
  return options.body === undefined ? undefined : JSON.stringify(options.body);
}

function signalOf(options: ApiRequestOptions): AbortSignal {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  return options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
}

async function readResponse<T>(response: Response, method: ApiMethod): Promise<ApiResult<T>> {
  let parsed: unknown;
  try {
    parsed = await readJson(response, method);
  } catch {
    return { ok: false, failure: { kind: 'unavailable', status: response.status, reason: 'badResponse' } };
  }
  if (response.ok) {
    // The shape is the backend's contract (shared/contracts): this server trusts its own backend.
    return { ok: true, status: response.status, data: parsed as T };
  }
  return { ok: false, failure: failureOf(response.status, parsed) };
}

async function readJson(response: Response, method: ApiMethod): Promise<unknown> {
  if (method === 'HEAD' || NO_BODY_STATUSES.has(response.status)) return undefined;
  const text = await response.text();
  if (text === '') return undefined;
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) throw new Error('not JSON');
  return JSON.parse(text);
}

/** An error body of the backend → its failure; anything else (a proxy's HTML 502 …) is "unavailable". */
export function failureOf(status: number, body: unknown): ApiFailure {
  if (isRecord(body) && body.error === 'validation' && isRecord(body.fields)) {
    return { kind: 'validation', status, fields: messageRefs(body.fields) };
  }
  if (isRecord(body) && typeof body.error === 'string' && typeof body.key === 'string') {
    const message: MessageRef = { key: body.key, ...(isValues(body.values) ? { values: body.values } : {}) };
    // `error` is one of the contract's codes (shared/contracts/errors.ts).
    return { kind: 'domain', status, error: body.error as ApiErrorCode, message, ...detailsOf(body.details) };
  }
  return { kind: 'unavailable', status, reason: 'badResponse' };
}

/** `details` of an error body when it is one (machine-readable extras, e.g. a rate limit's retryAfterSeconds). */
function detailsOf(value: unknown): { details?: Readonly<Record<string, string | number | boolean>> } {
  if (!isRecord(value)) return {};
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string | number | boolean] =>
      typeof entry[1] === 'string' || typeof entry[1] === 'number' || typeof entry[1] === 'boolean',
  );
  return { details: Object.fromEntries(entries) };
}

function messageRefs(fields: Record<string, unknown>): Record<string, MessageRef> {
  const refs: Record<string, MessageRef> = {};
  for (const [path, value] of Object.entries(fields)) {
    if (!isRecord(value) || typeof value.key !== 'string') continue;
    refs[path] = isValues(value.values) ? { key: value.key, values: value.values } : { key: value.key };
  }
  return refs;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValues(value: unknown): value is Record<string, string | number> {
  return isRecord(value) && Object.values(value).every(item => typeof item === 'string' || typeof item === 'number');
}
