import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import sharp from 'sharp';

import type { ApiErrorResponse } from '~shared/contracts/errors';
import type { MediaItem } from '~shared/contracts/media';

import { ConfigService } from '~config';
import { MAX_UPLOAD_BYTES, MEDIA_MIME } from '~core/media/media.constants';
import { Media } from '~prisma-generated/prisma/client';
import { ApiResponse } from '~test/e2e/api-client';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { MediaFixtures } from '~usecases/admin/media/common/test/media-fixtures';
import { MultipartClient } from '~usecases/admin/media/common/test/multipart-client';

import { MEDIA_UPLOAD_ROUTE } from './media-upload.route';

describe('[e2e] POST /api/v1/admin/media', () => {
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let client: MultipartClient;
  let fixtures: MediaFixtures;
  const storedKeys: string[] = [];

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    client = MultipartClient.of(app);
    fixtures = MediaFixtures.start(app.database, admin.id);
  });

  after(async () => {
    await app.mediaDisk.delete(storedKeys);
    await fixtures.remove();
    await admin.remove();
    await app.stop();
  });

  function formWith(data: Uint8Array, name: string, field = 'file'): FormData {
    const form = new FormData();
    form.append(field, new Blob([new Uint8Array(data)]), name);
    return form;
  }

  async function upload<T = ApiErrorResponse>(form: FormData) {
    return client.post<T>(MEDIA_UPLOAD_ROUTE, { body: form }, accessToken);
  }

  async function mediaCountOfAdmin(): Promise<number> {
    return app.database.client.media.count({ where: { ownerId: admin.id } });
  }

  describe('an accepted image', () => {
    let response: ApiResponse<MediaItem>;
    let row: Media;

    before(async () => {
      const png = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: '#c00' } })
        .png()
        .toBuffer();
      response = await upload<MediaItem>(formWith(png, 'Фото <худи>.png'));
      fixtures.track(response.body.id);
      row = await app.database.client.media.findUniqueOrThrow({ where: { id: response.body.id } });
      storedKeys.push(row.key);
    });

    it('answers 201 with the file: WebP inside 2400×2400, the cleaned original name, no alt, unused', () => {
      strictEqual(response.status, 201);
      const { id, url, size, createdAt } = row;
      const file = { id, url, width: 2400, height: 1200, alt: {}, mime: MEDIA_MIME, size };
      const meta = { originalName: 'Фото худи.png', createdAt: createdAt.toISOString(), usageCount: 0 };
      deepStrictEqual(response.body, { ...file, ...meta });
    });

    it('stores it as admin/<admin id>/<uuid>/image.webp of the media bucket, owned by the admin', async () => {
      strictEqual(row.key, `admin/${admin.id}/${row.uuid}/image.webp`);
      const bucket = app.get(ConfigService).getSafety('S3_BUCKET');
      deepStrictEqual(
        [row.ownerType, row.ownerId, row.url, row.bucket],
        ['ADMIN', admin.id, `/media/${row.key}`, bucket],
      );
      const stored = await app.mediaDisk.stat(row.key);
      deepStrictEqual([stored.contentType, stored.size], [MEDIA_MIME, row.size]);
    });
  });

  it('refuses a request without a file (400 noFile), also a JSON one', async () => {
    const form = new FormData();
    form.append('note', 'no file here');
    const multipart = await upload(form);
    deepStrictEqual([multipart.status, multipart.body.key], [400, 'admin.media.errors.noFile']);
    const json = await app.api.post<ApiErrorResponse>(MEDIA_UPLOAD_ROUTE, { body: { file: 'x' }, accessToken });
    deepStrictEqual([json.status, json.body.key], [400, 'admin.media.errors.noFile']);
  });

  it('refuses an empty file and anything that is not a raster image by its bytes, storing nothing', async () => {
    const before = await mediaCountOfAdmin();
    const empty = await upload(formWith(new Uint8Array(), 'empty.png'));
    deepStrictEqual([empty.status, empty.body.key], [400, 'admin.media.errors.empty']);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const unsupported = await upload(formWith(svg, 'photo.png'));
    deepStrictEqual(
      [unsupported.status, unsupported.body.key, unsupported.body.values],
      [415, 'admin.media.errors.unsupported', { formats: 'JPEG, PNG, WebP, AVIF, GIF' }],
    );
    strictEqual(await mediaCountOfAdmin(), before);
  });

  it('reports a corrupt image with a valid signature as processingFailed', async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } })
      .png()
      .toBuffer();
    const response = await upload(formWith(Buffer.concat([png.subarray(0, 24), Buffer.alloc(64, 7)]), 'bad.png'));
    deepStrictEqual([response.status, response.body.key], [400, 'admin.media.errors.processingFailed']);
  });

  it('refuses a file over 50 MB with 413 tooLarge { size: 50 } while streaming', async () => {
    const response = await upload(formWith(new Uint8Array(MAX_UPLOAD_BYTES + 1), 'huge.jpg'));
    deepStrictEqual(
      [response.status, response.body.key, response.body.values],
      [413, 'admin.media.errors.tooLarge', { size: 15 }],
    );
  });

  it('answers a body that is not readable multipart with 400 unreadable', async () => {
    const response = await client.post<ApiErrorResponse>(
      MEDIA_UPLOAD_ROUTE,
      {
        body: '--x\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\n\r\nabc',
        contentType: 'multipart/form-data; boundary=x',
      },
      accessToken,
    );
    deepStrictEqual([response.status, response.body.key], [400, 'admin.media.errors.unreadable']);
    ok(response.headers.get('cache-control')?.includes('no-store'));
  });
});
