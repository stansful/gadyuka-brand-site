import { deepStrictEqual, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { MediaObjectRemoval } from '~usecases/admin/media/common/media-object-removal.enum';
import { MediaObjectCleaner } from '~usecases/admin/media/common/media-object.cleaner';
import { FailingDeleteDisk } from '~usecases/admin/media/common/test/failing-delete.disk';
import { MediaTestEnvironment } from '~usecases/admin/media/common/test/media-test-environment';

describe('MediaObjectCleaner', () => {
  const key = 'admin/0199f2c4-0000-7000-8000-000000000001/3f2b8c1e-9a4d-4e7f-8b2a-1c3d5e7f9a0b/image.webp';

  it('deletes the stored file of a row of the media bucket', async () => {
    const media = new MediaTestEnvironment();
    await media.disk.put(key, Buffer.from('webp'));
    const cleaner = new MediaObjectCleaner(media.createStorage(), media.config);
    strictEqual(await cleaner.remove({ bucket: media.bucket, key }), MediaObjectRemoval.REMOVED);
    deepStrictEqual(media.disk.keys(), []);
  });

  it('reports a storage failure instead of throwing (the file stays unreferenced)', async () => {
    const media = new MediaTestEnvironment(new FailingDeleteDisk());
    await media.disk.put(key, Buffer.from('webp'));
    const cleaner = new MediaObjectCleaner(media.createStorage(), media.config);
    strictEqual(await cleaner.remove({ bucket: media.bucket, key }), MediaObjectRemoval.FAILED);
    deepStrictEqual(media.disk.keys(), [key]);
  });

  it('never deletes a same-named file of the media bucket for a row of another bucket', async () => {
    const media = new MediaTestEnvironment();
    await media.disk.put(key, Buffer.from('webp'));
    const cleaner = new MediaObjectCleaner(media.createStorage(), media.config);
    strictEqual(await cleaner.remove({ bucket: 'old-bucket', key }), MediaObjectRemoval.OTHER_BUCKET);
    deepStrictEqual(media.disk.keys(), [key]);
  });
});
