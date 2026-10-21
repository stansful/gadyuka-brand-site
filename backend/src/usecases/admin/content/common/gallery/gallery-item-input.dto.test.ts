import { deepStrictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';

import { DtoValidation } from '../test/dto-validation';
import { GalleryItemInputDto } from './gallery-item-input.dto';

describe('GalleryItemInputDto (port of the admin galleryInputSchema)', () => {
  const valid = { mediaId: randomUUID(), caption: {}, published: true };

  it('requires the photo and limits the caption per translation', async () => {
    deepStrictEqual(await DtoValidation.fieldsOf(GalleryItemInputDto, valid), {});
    deepStrictEqual(await DtoValidation.fieldsOf(GalleryItemInputDto, { ...valid, mediaId: '' }), {
      mediaId: { key: 'admin.validation.idRequired' },
    });
    deepStrictEqual(
      await DtoValidation.fieldsOf(GalleryItemInputDto, { ...valid, mediaId: null, caption: { en: 'x'.repeat(301) } }),
      {
        mediaId: { key: 'admin.validation.idRequired' },
        'caption.en': { key: 'admin.validation.tooLong', values: { max: 300 } },
      },
    );
  });
});
