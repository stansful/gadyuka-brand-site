import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

/** What ApiExceptionFilter sends: the HTTP status and one of the contract's error bodies. */
export interface RenderedError {
  readonly status: number;
  readonly body: ApiErrorResponse | ApiValidationErrorResponse;
}

/** One kind of thrown value → its error response (strategies of ApiExceptionFilter). */
export interface ExceptionRenderer {
  canRender(exception: unknown): boolean;
  render(exception: unknown): RenderedError;
}
