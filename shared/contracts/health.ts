/**
 * GET /api/v1/public/health — 200 with HealthResponse when every dependency answers; otherwise
 * 503 ApiErrorResponse with error "unavailable" and details { database, storage } ("up" | "down").
 */

export type DependencyState = 'up' | 'down';

export interface HealthResponse {
  readonly status: 'ok';
  readonly database: DependencyState;
  readonly storage: DependencyState;
  /** Seconds since the process started */
  readonly uptimeSeconds: number;
  /** ISO 8601 */
  readonly timestamp: string;
}
