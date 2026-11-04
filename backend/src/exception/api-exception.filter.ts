import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { NodeResponse } from '@nestjs/platform-node';

import { DomainExceptionRenderer } from './renderers/domain-exception.renderer';
import { HttpErrorRenderer } from './renderers/http-error.renderer';
import { HttpExceptionRenderer } from './renderers/http-exception.renderer';
import { PrismaErrorRenderer } from './renderers/prisma-error.renderer';
import { ExceptionRenderer, RenderedError } from './renderers/rendered-error';
import { StorageErrorRenderer } from './renderers/storage-error.renderer';
import { UnexpectedErrorRenderer } from './renderers/unexpected-error.renderer';
import { ValidationFailedRenderer } from './renderers/validation-failed.renderer';

/**
 * The one place errors become HTTP answers (shared/contracts/errors.ts): typed domain exceptions,
 * validation failures, known database errors (unique / foreign key / missing row), Nest/Node/storage
 * errors and unexpected ones. Error answers are never
 * cached; 5xx are logged with the stack, 4xx are not (they are the client's business).
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);
  private readonly renderers: readonly ExceptionRenderer[] = [
    new ValidationFailedRenderer(),
    new DomainExceptionRenderer(),
    new PrismaErrorRenderer(),
    new StorageErrorRenderer(),
    new HttpExceptionRenderer(),
    new HttpErrorRenderer(),
    new UnexpectedErrorRenderer(),
  ];

  catch(exception: unknown, host: ArgumentsHost): void {
    const rendered = this.render(exception);
    this.logServerError(exception, rendered);
    this.send(host.switchToHttp().getResponse<NodeResponse>(), rendered);
  }

  private render(exception: unknown): RenderedError {
    const renderer = this.renderers.find(candidate => candidate.canRender(exception)) ?? new UnexpectedErrorRenderer();
    return renderer.render(exception);
  }

  private send(reply: NodeResponse, rendered: RenderedError): void {
    if (reply.headersSent) {
      return;
    }
    reply.status(rendered.status).set('Cache-Control', 'no-store').send(rendered.body);
  }

  private logServerError(exception: unknown, rendered: RenderedError): void {
    if (rendered.status < HttpStatus.INTERNAL_SERVER_ERROR) {
      return;
    }
    const error = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(`ApiExceptionFilter : ${error.name} : ${error.message}`, error.stack);
  }
}
