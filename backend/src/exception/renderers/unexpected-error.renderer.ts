import { HttpStatus } from '@nestjs/common';

import { HttpStatusError } from './http-status-error';
import { ExceptionRenderer, RenderedError } from './rendered-error';

/** Anything else: a bug or an unavailable dependency — 500 without details (they are logged). */
export class UnexpectedErrorRenderer implements ExceptionRenderer {
  canRender(): boolean {
    return true;
  }

  render(): RenderedError {
    return HttpStatusError.of(HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
