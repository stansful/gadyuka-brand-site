import { MultipartOptions } from '@nestjs/platform-fastify/multipart';

import { MAX_MEDIA_UPLOAD_FIELDS, MAX_MEDIA_UPLOAD_FIELD_BYTES } from '~core/media/media-library.constants';
import { MAX_UPLOAD_BYTES } from '~core/media/media.constants';

/**
 * Multipart parsing of an upload (FileInterceptor, memory storage): one file of at most
 * MAX_UPLOAD_BYTES (a larger one ends the request with 413 while streaming), a few small text
 * fields, UTF-8 file names (browsers send them unencoded; busboy's default is latin1).
 */
export class MediaUploadOptions {
  static readonly MULTIPART: MultipartOptions = {
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: 1,
      fields: MAX_MEDIA_UPLOAD_FIELDS,
      fieldSize: MAX_MEDIA_UPLOAD_FIELD_BYTES,
      // the text fields + the one file
      parts: MAX_MEDIA_UPLOAD_FIELDS + 1,
    },
    defParamCharset: 'utf8',
  };
}
