import { Injectable, Logger } from '@nestjs/common';

import sharp from 'sharp';

import { AcceptedImageMime } from '~core/media/accepted-image-mime.enum';
import {
  IMAGE_THREADS,
  MAX_IMAGE_DIMENSION,
  MAX_INPUT_PIXELS,
  MAX_UPLOAD_BYTES,
  MEDIA_MIME,
  WEBP_EFFORT,
  WEBP_QUALITY,
} from '~core/media/media.constants';

import { ImageJobQueue } from './image-job.queue';
import { ImageTypeDetector } from './image-type.detector';
import { ImageValidationCode } from './image-validation-code.enum';
import { ImageValidationException } from './image-validation.exception';

export interface ProcessedImage {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
  readonly mime: typeof MEDIA_MIME;
  readonly size: number;
  readonly sourceMime: AcceptedImageMime;
}

/**
 * Upload pipeline (port of the frontend's src/lib/media.ts): size check → type by magic bytes →
 * sharp: auto-orient, fit inside 2400×2400 (never upscale), strip metadata (EXIF/GPS), first frame
 * of an animation only, WebP. Throws ImageValidationException.
 */
@Injectable()
export class ImageProcessor {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(
    private readonly detector: ImageTypeDetector,
    private readonly queue: ImageJobQueue,
  ) {
    sharp.concurrency(IMAGE_THREADS);
  }

  async process(data: Uint8Array): Promise<ProcessedImage> {
    const sourceMime = this.detectAcceptedType(data);
    const { data: output, info } = await this.convertInQueue(data);
    return {
      data: output,
      width: info.width,
      height: info.height,
      mime: MEDIA_MIME,
      size: output.byteLength,
      sourceMime,
    };
  }

  private detectAcceptedType(data: Uint8Array): AcceptedImageMime {
    this.assertSize(data);
    const sourceMime = this.detector.detect(data);
    if (sourceMime === undefined) {
      throw new ImageValidationException(ImageValidationCode.UNSUPPORTED);
    }
    return sourceMime;
  }

  private assertSize(data: Uint8Array): void {
    if (data.byteLength === 0) {
      throw new ImageValidationException(ImageValidationCode.EMPTY);
    }
    if (data.byteLength > MAX_UPLOAD_BYTES) {
      throw new ImageValidationException(ImageValidationCode.TOO_LARGE);
    }
  }

  private async convertInQueue(data: Uint8Array): Promise<{ data: Buffer; info: sharp.OutputInfo }> {
    try {
      return await this.queue.run(() => this.convert(data));
    } catch (error: unknown) {
      this.logger.warn('ImageProcessor : sharp could not process an upload', { error: this.describe(error) });
      throw new ImageValidationException(ImageValidationCode.PROCESSING_FAILED, error);
    }
  }

  private convert(data: Uint8Array): Promise<{ data: Buffer; info: sharp.OutputInfo }> {
    return sharp(data, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error', animated: false })
      .autoOrient()
      .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
      .toBuffer({ resolveWithObject: true });
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
