/** Transport rules of the backend API (the frontend's server-side client follows them). */

/** Every route except GET|HEAD /media/* lives under this prefix. */
export type ApiPrefix = '/api/v1';

/**
 * Request headers the backend reads:
 * - `x-internal-key`: INTERNAL_API_KEY, on every request except GET|HEAD /media/* (401 without it);
 * - `x-client-ip`: the visitor's IP as the Next.js server saw it (rate limits, lead hashes);
 * - `x-client-user-agent`: the visitor's User-Agent as the Next.js server saw it (lead metadata, admin
 *   sessions); left out when the visitor sent none. The transport's own `user-agent` (Node's fetch
 *   sends "node") is never read as the visitor's;
 * - `authorization`: `Bearer <accessToken>` on the routes that need a signed-in user.
 */
export type ApiRequestHeader = 'x-internal-key' | 'x-client-ip' | 'x-client-user-agent' | 'authorization';

/**
 * How long the frontend's client waits for an answer, in milliseconds, unless a route says otherwise
 * (leads.ts LeadResendTimeoutMs, site-texts.ts SiteTextsWriteTimeoutMs). The backend keeps the budgets of a request (waiting for a
 * database connection, transactions) below it, so an answer the client gave up on never hides a write
 * that still commits.
 */
export type ApiRequestTimeoutMs = 10_000;
