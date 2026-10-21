import { Injectable } from '@nestjs/common';
import { detectContentType } from '@nestjs/storage';

import { AcceptedImageMime } from '~core/media/accepted-image-mime.enum';

/** The type of an upload by its magic bytes (never by extension or the client's claim). */
@Injectable()
export class ImageTypeDetector {
  private static readonly SAMPLE_BYTES = 16;
  private static readonly ACCEPTED: ReadonlySet<string> = new Set(Object.values(AcceptedImageMime));

  /** The accepted image type of `data`, or undefined (SVG, PDF, HEIC, anything else). */
  detect(data: Uint8Array): AcceptedImageMime | undefined {
    const detected = detectContentType(Buffer.from(data.subarray(0, ImageTypeDetector.SAMPLE_BYTES)));
    return detected !== undefined && ImageTypeDetector.ACCEPTED.has(detected)
      ? (detected as AcceptedImageMime)
      : undefined;
  }
}
