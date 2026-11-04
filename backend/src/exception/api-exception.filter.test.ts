import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { afterEach, describe, it, mock } from 'node:test';

import { Logger, NotFoundException } from '@nestjs/common';
import { StorageFileNotFoundError, StorageServiceError } from '@nestjs/storage';

import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { ApiExceptionFilter, DomainErrorKind, DomainException } from '~exception';

/** What the filter sent: the parts of a Node response it uses. */
class RecordingReply {
  private sentStatus: number | undefined;
  private sentBody: unknown;
  private readonly sentHeaders = new Map<string, string>();

  constructor(readonly headersSent = false) {}

  get statusCode(): number | undefined {
    return this.sentStatus;
  }

  get body(): unknown {
    return this.sentBody;
  }

  headerOf(name: string): string | undefined {
    return this.sentHeaders.get(name);
  }

  status(code: number): this {
    this.sentStatus = code;
    return this;
  }

  set(name: string, value: string): this {
    this.sentHeaders.set(name, value);
    return this;
  }

  send(body: unknown): this {
    this.sentBody = body;
    return this;
  }
}

/** A dependency that is down, as a typed domain exception (503 with details). */
class ProbeUnavailableException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.UNAVAILABLE,
      code: ApiErrorCode.UNAVAILABLE,
      messageKey: AdminMessageKey.ERRORS_ACTION_FAILED,
      details: { database: 'down' },
    });
  }
}

describe('ApiExceptionFilter (server errors)', () => {
  const filter = new ApiExceptionFilter();

  afterEach(() => {
    mock.restoreAll();
  });

  /** The filter's error log, silenced and recorded. */
  function spyOnErrorLog() {
    return mock.method(Logger.prototype, 'error', () => undefined);
  }

  function answerTo(exception: unknown, reply = new RecordingReply()): RecordingReply {
    filter.catch(exception, new ExecutionContextHost([{}, reply]));
    return reply;
  }

  it('answers an unexpected error with the generic 500 body (no message, no stack), never cached, logged', () => {
    const loggedErrors = spyOnErrorLog();
    const reply = answerTo(new Error('password authentication failed at 10.0.0.5:5432'));
    strictEqual(reply.statusCode, 500);
    deepStrictEqual(reply.body, { statusCode: 500, error: 'internal', key: 'admin.errors.actionFailed' });
    strictEqual(reply.headerOf('Cache-Control'), 'no-store');
    strictEqual(loggedErrors.mock.callCount(), 1);
    const logged = loggedErrors.mock.calls[0]?.arguments.map(String).join('\n') ?? '';
    ok(logged.includes('10.0.0.5'), 'the details go to the log, not to the answer');
    ok(logged.includes('api-exception.filter.test'), 'with the stack');
  });

  it('treats a thrown non-error as unexpected too', () => {
    const loggedErrors = spyOnErrorLog();
    deepStrictEqual(answerTo('boom').body, { statusCode: 500, error: 'internal', key: 'admin.errors.actionFailed' });
    strictEqual(loggedErrors.mock.callCount(), 1);
  });

  it('answers a storage outage with 502 storageUnavailable, a missing object with 404', () => {
    const loggedErrors = spyOnErrorLog();
    const outage = new StorageServiceError({ operation: 'get', code: 'NetworkError', message: 'ECONNREFUSED' });
    const reply = answerTo(outage);
    strictEqual(reply.statusCode, 502);
    deepStrictEqual(reply.body, { statusCode: 502, error: 'storageUnavailable', key: 'admin.errors.actionFailed' });
    strictEqual(answerTo(new StorageFileNotFoundError('admin/x/image.webp')).statusCode, 404);
    strictEqual(loggedErrors.mock.callCount(), 1, 'only the 5xx is logged');
  });

  it('answers an UNAVAILABLE domain exception with 503 and its details', () => {
    const loggedErrors = spyOnErrorLog();
    const reply = answerTo(new ProbeUnavailableException());
    strictEqual(reply.statusCode, 503);
    deepStrictEqual(reply.body, {
      statusCode: 503,
      error: 'unavailable',
      key: 'admin.errors.actionFailed',
      details: { database: 'down' },
    });
    strictEqual(loggedErrors.mock.callCount(), 1);
  });

  it('does not log client errors (4xx)', () => {
    const loggedErrors = spyOnErrorLog();
    strictEqual(answerTo(new NotFoundException()).statusCode, 404);
    strictEqual(loggedErrors.mock.callCount(), 0);
  });

  it('sends nothing when the answer already went out (still logs the server error)', () => {
    const loggedErrors = spyOnErrorLog();
    const reply = answerTo(new Error('after the headers'), new RecordingReply(true));
    strictEqual(reply.statusCode, undefined);
    strictEqual(reply.body, undefined);
    strictEqual(loggedErrors.mock.callCount(), 1);
  });
});
