import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteObject, putObject } from '@/lib/storage';

import {
  detectImageMime,
  MAX_CONCURRENT_IMAGE_JOBS,
  MAX_IMAGE_DIMENSION,
  MAX_UPLOAD_BYTES,
  MediaValidationError,
  processImage,
  removeStoredImage,
  sanitizeOriginalName,
  storeProcessedImage,
  withImageJobSlot,
} from './media';

// S3 is mocked: these tests cover the key layout and what is sent, not MinIO itself.
vi.mock('@/lib/storage', () => ({
  putObject: vi.fn(async () => ({ etag: '"etag"' })),
  deleteObject: vi.fn(async () => undefined),
  getMediaBucket: vi.fn(() => 'test-media'),
}));

const OWNER_ID = 'cmh1x2y3z0000abcd1234efgh';

async function makeImage(
  width: number,
  height: number,
  format: 'png' | 'jpeg' | 'gif' | 'webp' = 'png',
): Promise<Uint8Array> {
  const image = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 40 } } });
  const buffer = await image.toFormat(format).toBuffer();
  return new Uint8Array(buffer);
}

describe('detectImageMime (magic bytes)', () => {
  it('detects raster formats regardless of file name', async () => {
    expect(await detectImageMime(await makeImage(4, 4, 'png'))).toBe('image/png');
    expect(await detectImageMime(await makeImage(4, 4, 'jpeg'))).toBe('image/jpeg');
    expect(await detectImageMime(await makeImage(4, 4, 'gif'))).toBe('image/gif');
    expect(await detectImageMime(await makeImage(4, 4, 'webp'))).toBe('image/webp');
  });

  it('rejects SVG, HTML and other non-images', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const html = new TextEncoder().encode('<!doctype html><script>alert(1)</script>');
    const pdf = new TextEncoder().encode('%PDF-1.7\n%âãÏÓ\n1 0 obj\n');
    expect(await detectImageMime(svg)).toBeNull();
    expect(await detectImageMime(html)).toBeNull();
    expect(await detectImageMime(pdf)).toBeNull();
  });
});

describe('processImage', () => {
  it('converts to WebP and keeps dimensions of small images (no upscaling)', async () => {
    const result = await processImage(await makeImage(640, 480, 'jpeg'));
    expect(result.mime).toBe('image/webp');
    expect(result.sourceMime).toBe('image/jpeg');
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
    expect(result.size).toBe(result.data.byteLength);
    expect(await detectImageMime(result.data)).toBe('image/webp');
  });

  it('fits large images inside 2400×2400 keeping the aspect ratio', async () => {
    const result = await processImage(await makeImage(4800, 1200, 'png'));
    expect(result.width).toBe(MAX_IMAGE_DIMENSION);
    expect(result.height).toBe(600);
  });

  it('rejects SVG (the admin shows admin.media.errors.unsupported)', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
    await expect(processImage(svg)).rejects.toBeInstanceOf(MediaValidationError);
    await expect(processImage(svg)).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('rejects empty and oversized files', async () => {
    await expect(processImage(new Uint8Array())).rejects.toMatchObject({ code: 'empty' });
    await expect(processImage(new Uint8Array(MAX_UPLOAD_BYTES + 1))).rejects.toMatchObject({ code: 'tooLarge' });
  });

  it('rejects a truncated image that only has valid magic bytes', async () => {
    const png = await makeImage(64, 64, 'png');
    await expect(processImage(png.slice(0, 40))).rejects.toMatchObject({ code: 'processingFailed' });
  });
});

describe('original names', () => {
  it('sanitizes original names for display', () => {
    expect(sanitizeOriginalName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeOriginalName('C:\\Users\\me\\Фото худи.JPG')).toBe('Фото худи.JPG');
    expect(sanitizeOriginalName('bad\u0000name<script>.png')).toBe('badnamescript.png');
    expect(sanitizeOriginalName('   ')).toBe('image');
    expect(sanitizeOriginalName(`${'a'.repeat(300)}.png`).length).toBe(200);
  });
});

describe('storeProcessedImage / removeStoredImage (S3)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uploads into a new per-upload folder with immutable caching and returns the row fields', async () => {
    const image = await processImage(await makeImage(10, 10));
    const stored = await storeProcessedImage(image, { ownerType: 'ADMIN', ownerId: OWNER_ID });

    expect(stored.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(stored.key).toBe(`admin/${OWNER_ID}/${stored.uuid}/image.webp`);
    expect(stored.url).toBe(`/media/${stored.key}`);
    expect(stored.bucket).toBe('test-media');
    expect(vi.mocked(putObject)).toHaveBeenCalledWith({
      key: stored.key,
      body: image.data,
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    const again = await storeProcessedImage(image, { ownerType: 'ADMIN', ownerId: OWNER_ID });
    expect(again.uuid).not.toBe(stored.uuid);
  });

  it('never builds a key from an unsafe owner id', async () => {
    const image = await processImage(await makeImage(10, 10));
    await expect(storeProcessedImage(image, { ownerType: 'ADMIN', ownerId: '../../etc' })).rejects.toThrow();
    expect(vi.mocked(putObject)).not.toHaveBeenCalled();
  });

  it('deletes the object from the bucket of its row', async () => {
    await removeStoredImage({ bucket: 'old-bucket', key: `admin/${OWNER_ID}/x/image.webp` });
    expect(vi.mocked(deleteObject)).toHaveBeenCalledWith(`admin/${OWNER_ID}/x/image.webp`, 'old-bucket');
  });
});

describe('withImageJobSlot', () => {
  it(`runs at most ${MAX_CONCURRENT_IMAGE_JOBS} image jobs at once and drains the queue in order`, async () => {
    let running = 0;
    let peak = 0;
    const finished: number[] = [];
    const job = (id: number) => async (): Promise<number> => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise(resolve => setTimeout(resolve, 5));
      running -= 1;
      finished.push(id);
      return id;
    };
    const results = await Promise.all([1, 2, 3, 4, 5].map(id => withImageJobSlot(job(id))));
    expect(results).toEqual([1, 2, 3, 4, 5]);
    expect(peak).toBe(MAX_CONCURRENT_IMAGE_JOBS);
    expect(finished).toHaveLength(5);
  });

  it('releases the slot when a job fails', async () => {
    await expect(withImageJobSlot(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    const results = await Promise.all(
      Array.from({ length: MAX_CONCURRENT_IMAGE_JOBS + 1 }, (_, index) => withImageJobSlot(async () => index)),
    );
    expect(results).toHaveLength(MAX_CONCURRENT_IMAGE_JOBS + 1);
  });
});
