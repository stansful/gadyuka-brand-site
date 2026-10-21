import { HttpException } from '@nestjs/common';

import { HttpStatusError } from './http-status-error';
import { ExceptionRenderer, RenderedError } from './rendered-error';

/** Nest / library HttpExceptions (unknown route, 413 of a multipart body, 404 of serveFile …). */
export class HttpExceptionRenderer implements ExceptionRenderer {
  canRender(exception: unknown): boolean {
    return exception instanceof HttpException;
  }

  render(exception: HttpException): RenderedError {
    return HttpStatusError.of(exception.getStatus());
  }
}
