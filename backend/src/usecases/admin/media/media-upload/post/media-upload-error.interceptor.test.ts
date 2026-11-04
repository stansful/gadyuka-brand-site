import { deepStrictEqual, ok } from 'node:assert';
import { describe, it } from 'node:test';

import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';

import { firstValueFrom, throwError } from 'rxjs';

import { ImageValidationException } from '~module/image';

import { MediaUploadErrorInterceptor } from './media-upload-error.interceptor';
import { MediaUploadUnreadableException } from './media-upload-unreadable.exception';

async function errorOf(thrown: Error): Promise<unknown> {
  const next: CallHandler = { handle: () => throwError(() => thrown) };
  const context = {} as ExecutionContext;
  return firstValueFrom(new MediaUploadErrorInterceptor().intercept(context, next)).catch((error: unknown) => error);
}

describe('MediaUploadErrorInterceptor', () => {
  it('answers a file over the multipart limit with the tooLarge key and its size', async () => {
    const error = await errorOf(new PayloadTooLargeException('File too large'));
    ok(error instanceof ImageValidationException);
    deepStrictEqual([error.messageKey, error.values], ['admin.media.errors.tooLarge', { size: 50 }]);
  });

  it('answers an unreadable or cut off multipart body with the unreadable key, and passes anything else through', async () => {
    const unreadable = await errorOf(new BadRequestException('Multipart: Unexpected end of form'));
    ok(unreadable instanceof MediaUploadUnreadableException);
    deepStrictEqual(unreadable.messageKey, 'admin.media.errors.unreadable');
    const cutOff = Object.assign(new Error('aborted'), { code: 'ECONNRESET' });
    ok((await errorOf(cutOff)) instanceof MediaUploadUnreadableException);
    const other = new NotFoundException();
    deepStrictEqual(await errorOf(other), other);
  });
});
