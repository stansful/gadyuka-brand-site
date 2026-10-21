import type { MessageValues } from '~shared/contracts/errors';

import { ApiErrorCode } from '~core/constants/api-error-code.enum';

import { DomainErrorKind } from './domain-error-kind.enum';

/** Machine-readable extras of an error body (shared/contracts/errors.ts, `details`). */
export type DomainErrorDetails = Readonly<Record<string, string | number | boolean>>;

export interface DomainExceptionOptions {
  readonly kind: DomainErrorKind;
  readonly code: ApiErrorCode;
  /** Message key of shared/messages the client shows (translated by the frontend) */
  readonly messageKey: string;
  readonly values?: MessageValues;
  readonly details?: DomainErrorDetails;
  readonly cause?: unknown;
}

/**
 * Base of every typed domain exception. Thrown anywhere below the controllers; the global
 * ApiExceptionFilter turns it into `{ statusCode, error: code, key, values, details }`.
 * Concrete exceptions extend this class directly (one level).
 */
export abstract class DomainException extends Error {
  readonly kind: DomainErrorKind;
  readonly code: ApiErrorCode;
  readonly messageKey: string;
  readonly values: MessageValues | undefined;
  readonly details: DomainErrorDetails | undefined;

  protected constructor(options: DomainExceptionOptions) {
    super(`${options.code} (${options.messageKey})`, { cause: options.cause });
    this.name = new.target.name;
    this.kind = options.kind;
    this.code = options.code;
    this.messageKey = options.messageKey;
    this.values = options.values;
    this.details = options.details;
  }
}
