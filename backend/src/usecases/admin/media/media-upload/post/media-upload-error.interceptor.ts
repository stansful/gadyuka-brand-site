import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';

import { Observable, catchError, throwError } from 'rxjs';

import { ImageValidationCode, ImageValidationException } from '~module/image';

import { MediaUploadUnreadableException } from './media-upload-unreadable.exception';

/**
 * Errors of the multipart parser (FileInterceptor) → the media library's own answers, as the
 * admin showed them before: a file over the limit → 413 admin.media.errors.tooLarge { size }, a
 * body that cannot be read or was cut off by the sender → 400 admin.media.errors.unreadable (a
 * client error, not a logged 500). Must wrap FileInterceptor (listed before it in @UseInterceptors).
 */
@Injectable()
export class MediaUploadErrorInterceptor implements NestInterceptor {
  /** Node's code of a request whose connection closed before its body ended. */
  private static readonly CONNECTION_RESET = 'ECONNRESET';

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(catchError((error: unknown) => throwError(() => this.translate(error))));
  }

  private translate(error: unknown): unknown {
    if (error instanceof PayloadTooLargeException) {
      return new ImageValidationException(ImageValidationCode.TOO_LARGE, error);
    }
    if (error instanceof BadRequestException || this.isCutOff(error)) {
      return new MediaUploadUnreadableException(error);
    }
    return error;
  }

  private isCutOff(error: unknown): boolean {
    return error instanceof Error && 'code' in error && error.code === MediaUploadErrorInterceptor.CONNECTION_RESET;
  }
}
