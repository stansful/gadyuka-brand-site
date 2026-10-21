/** Request headers the backend reads (shared/contracts/http.ts ApiRequestHeader). Lowercase: Node normalizes header names. */
export enum RequestHeader {
  INTERNAL_KEY = 'x-internal-key',
  CLIENT_IP = 'x-client-ip',
  /** The visitor's User-Agent forwarded by the site's server (never the transport's own `user-agent`) */
  CLIENT_USER_AGENT = 'x-client-user-agent',
  AUTHORIZATION = 'authorization',
}
