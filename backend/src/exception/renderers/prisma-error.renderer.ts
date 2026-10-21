import { HttpStatus } from '@nestjs/common';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { Prisma } from '~prisma-generated/prisma/client';

import { ExceptionRenderer, RenderedError } from './rendered-error';

interface PrismaErrorAnswer {
  readonly status: HttpStatus;
  readonly code: ApiErrorCode;
  readonly messageKey: AdminMessageKey;
}

/**
 * Known database errors that reach the filter (a usecase need not catch them): a unique violation,
 * a foreign key violation (the row is still referenced, or references a row that is gone) and a
 * missing row of an update / delete become 409 / 409 / 404 with the admin's message keys. Other
 * Prisma errors stay unexpected (500, logged).
 */
export class PrismaErrorRenderer implements ExceptionRenderer {
  private static readonly ANSWERS: Readonly<Record<string, PrismaErrorAnswer>> = {
    P2002: { status: HttpStatus.CONFLICT, code: ApiErrorCode.CONFLICT, messageKey: AdminMessageKey.ERRORS_DUPLICATE },
    P2003: { status: HttpStatus.CONFLICT, code: ApiErrorCode.CONFLICT, messageKey: AdminMessageKey.ERRORS_RELATED },
    P2025: { status: HttpStatus.NOT_FOUND, code: ApiErrorCode.NOT_FOUND, messageKey: AdminMessageKey.ERRORS_NOT_FOUND },
  };

  canRender(exception: unknown): boolean {
    return (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      Object.hasOwn(PrismaErrorRenderer.ANSWERS, exception.code)
    );
  }

  render(exception: Prisma.PrismaClientKnownRequestError): RenderedError {
    const { status, code, messageKey } = PrismaErrorRenderer.ANSWERS[exception.code];
    return { status, body: { statusCode: status, error: code, key: messageKey } };
  }
}
