import { deepStrictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';

import { DtoValidation } from '~usecases/admin/content/common/test/dto-validation';

import { GalleryBulkDto } from './gallery-bulk.dto';

describe('GalleryBulkDto (port of the admin bulkGallerySchema)', () => {
  const ids = (count: number): string[] => Array.from({ length: count }, () => randomUUID());

  it('takes 1…100 different media ids', async () => {
    deepStrictEqual(await DtoValidation.fieldsOf(GalleryBulkDto, { mediaIds: ids(1), published: true }), {});
    deepStrictEqual(await DtoValidation.fieldsOf(GalleryBulkDto, { mediaIds: ids(100), published: false }), {});
  });

  it('refuses an empty list, more than 100, repeats and malformed ids', async () => {
    deepStrictEqual(await DtoValidation.fieldsOf(GalleryBulkDto, { mediaIds: [], published: true }), {
      mediaIds: { key: 'admin.validation.photosRequired', values: { min: 1 } },
    });
    deepStrictEqual(await DtoValidation.fieldsOf(GalleryBulkDto, { mediaIds: ids(101), published: true }), {
      mediaIds: { key: 'admin.validation.photosBulkTooMany', values: { max: 100 } },
    });
    const [id] = ids(1);
    deepStrictEqual(await DtoValidation.fieldsOf(GalleryBulkDto, { mediaIds: [id, id], published: true }), {
      mediaIds: { key: 'admin.validation.photosDuplicate' },
    });
    deepStrictEqual(await DtoValidation.fieldsOf(GalleryBulkDto, { mediaIds: [id, 'm1'], published: 'yes' }), {
      mediaIds: { key: 'admin.validation.idInvalid' },
      published: { key: 'admin.validation.invalid' },
    });
  });
});
