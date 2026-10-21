import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import sharp from 'sharp';

import { AcceptedImageMime } from '~core/media/accepted-image-mime.enum';
import { MAX_IMAGE_DIMENSION, MAX_UPLOAD_BYTES, MEDIA_MIME } from '~core/media/media.constants';
import { OriginalFileName } from '~core/media/original-file-name';
import {
  ImageJobQueue,
  ImageProcessor,
  ImageTypeDetector,
  ImageValidationCode,
  ImageValidationException,
} from '~module/image';

const processor = new ImageProcessor(new ImageTypeDetector(), new ImageJobQueue());

function solidImage(width: number, height: number): sharp.Sharp {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 60 } } });
}

function refusedWith(code: ImageValidationCode): (error: unknown) => boolean {
  return error => error instanceof ImageValidationException && error.reason === code;
}

describe('ImageProcessor', () => {
  it('converts an accepted image to WebP, keeping its size', async () => {
    const png = await solidImage(10, 8).png().toBuffer();
    const image = await processor.process(png);
    strictEqual(image.mime, MEDIA_MIME);
    strictEqual(image.sourceMime, AcceptedImageMime.PNG);
    deepStrictEqual([image.width, image.height], [10, 8]);
    strictEqual(image.size, image.data.byteLength);
    strictEqual((await sharp(image.data).metadata()).format, 'webp');
  });

  it('fits large images inside 2400×2400 without upscaling small ones', async () => {
    const jpeg = await solidImage(3000, 1500).jpeg().toBuffer();
    const image = await processor.process(jpeg);
    deepStrictEqual([image.width, image.height], [MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION / 2]);
    strictEqual(image.sourceMime, AcceptedImageMime.JPEG);
  });

  it('refuses an empty or too large file before looking at it', async () => {
    await rejects(processor.process(new Uint8Array()), refusedWith(ImageValidationCode.EMPTY));
    await rejects(processor.process(new Uint8Array(MAX_UPLOAD_BYTES + 1)), refusedWith(ImageValidationCode.TOO_LARGE));
  });

  it('refuses anything that is not a raster image by its bytes (SVG, PDF, text with an image name)', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const pdf = Buffer.from('%PDF-1.7\n%%EOF\n');
    for (const data of [svg, pdf, Buffer.from('just text, named photo.png')]) {
      await rejects(processor.process(data), refusedWith(ImageValidationCode.UNSUPPORTED));
    }
  });

  it('reports a corrupt image with a valid signature as processingFailed', async () => {
    const png = await solidImage(4, 4).png().toBuffer();
    const corrupt = Buffer.concat([png.subarray(0, 24), Buffer.alloc(64, 7)]);
    await rejects(processor.process(corrupt), refusedWith(ImageValidationCode.PROCESSING_FAILED));
  });

  it('answers with admin.media.errors.* keys and their values', () => {
    const tooLarge = new ImageValidationException(ImageValidationCode.TOO_LARGE);
    strictEqual(tooLarge.messageKey, 'admin.media.errors.tooLarge');
    deepStrictEqual(tooLarge.values, { size: 15 });
    strictEqual(
      new ImageValidationException(ImageValidationCode.UNSUPPORTED).values?.formats,
      'JPEG, PNG, WebP, AVIF, GIF',
    );
  });
});

describe('ImageTypeDetector', () => {
  it('detects the accepted formats by magic bytes', async () => {
    const detector = new ImageTypeDetector();
    strictEqual(detector.detect(await solidImage(2, 2).webp().toBuffer()), AcceptedImageMime.WEBP);
    strictEqual(detector.detect(await solidImage(2, 2).gif().toBuffer()), AcceptedImageMime.GIF);
    strictEqual(detector.detect(await solidImage(2, 2).avif().toBuffer()), AcceptedImageMime.AVIF);
    strictEqual(detector.detect(Buffer.from('GIF')), undefined);
  });
});

describe('ImageJobQueue', () => {
  it('runs at most two jobs at once, in FIFO order', async () => {
    const queue = new ImageJobQueue();
    let running = 0;
    let peak = 0;
    const order: number[] = [];
    const job = (id: number) => async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise(resolve => setTimeout(resolve, 5));
      order.push(id);
      running -= 1;
      return id;
    };
    deepStrictEqual(await Promise.all([1, 2, 3, 4, 5].map(id => queue.run(job(id)))), [1, 2, 3, 4, 5]);
    strictEqual(peak, 2);
    deepStrictEqual(order, [1, 2, 3, 4, 5]);
  });

  it('frees the slot when a job fails', async () => {
    const queue = new ImageJobQueue();
    await rejects(queue.run(() => Promise.reject(new Error('boom'))));
    strictEqual(await queue.run(async () => 'next'), 'next');
  });
});

describe('OriginalFileName', () => {
  it('keeps a display name only: no folders, control or markup characters, at most 200 characters', () => {
    strictEqual(OriginalFileName.fromUpload('C:\\Users\\me\\Фото 1.JPG').toString(), 'Фото 1.JPG');
    strictEqual(OriginalFileName.fromUpload('../../etc/<pass>wd\u0000').toString(), 'passwd');
    strictEqual(OriginalFileName.fromUpload('  \u0007 ').toString(), 'image');
    const long = `${'a'.repeat(300)}.png`;
    ok(OriginalFileName.fromUpload(long).toString().endsWith('.png'));
    strictEqual(OriginalFileName.fromUpload(long).toString().length, 200);
  });
});
