import { HttpStatus } from '@nestjs/common';

import { HttpStatusError } from './http-status-error';
import { ExceptionRenderer, RenderedError } from './rendered-error';

interface ClientError {
  readonly statusCode: number;
}

/** HTTP parser errors with a 4xx status: malformed JSON, body too large, bad content type. */
export class HttpErrorRenderer implements ExceptionRenderer {
  canRender(exception: unknown): boolean {
    if (!(exception instanceof Error) || !('statusCode' in exception)) {
      return false;
    }
    const { statusCode } = exception as ClientError;
    return statusCode >= HttpStatus.BAD_REQUEST && statusCode < HttpStatus.INTERNAL_SERVER_ERROR;
  }

  render(exception: ClientError): RenderedError {
    return HttpStatusError.of(exception.statusCode);
  }
}
