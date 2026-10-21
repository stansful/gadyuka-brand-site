import { deepStrictEqual, match, rejects, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import sharp from 'sharp';

import { UserRole } from '~core/users/user-role';
import { DatabaseService } from '~database';
import {
  ImageJobQueue,
  ImageProcessor,
  ImageTypeDetector,
  ImageValidationCode,
  ImageValidationException,
} from '~module/image';
import { MediaObjectCleaner } from '~usecases/admin/media/common/media-object.cleaner';
import { MediaRecord } from '~usecases/admin/media/common/media-record';
import { MediaTestEnvironment } from '~usecases/admin/media/common/test/media-test-environment';

import { MediaFileMissingException } from './media-file-missing.exception';
import { MediaUploadRepository, NewMedia } from './media-upload.repository';
import { MediaUploadUsecase } from './media-upload.usecase';

const OWNER = { ownerType: UserRole.ADMIN, ownerId: '0199f2c4-0000-7000-8000-000000000001' };

/** Records the rows the usecase writes (no database). */
class RecordingRepository extends MediaUploadRepository {
  private readonly rows: NewMedia[] = [];

  constructor(media: MediaTestEnvironment) {
    super(new DatabaseService(media.config));
  }

  override async create(media: NewMedia): Promise<MediaRecord> {
    this.rows.push(media);
    const { mime, width, height, size } = media.image;
    const fields = { id: 'media-1', url: media.stored.url, alt: {}, originalName: media.originalName };
    return { ...fields, mime, width, height, size, createdAt: new Date('2026-10-20T12:00:00Z'), usageCount: 0 };
  }

  savedRows(): readonly NewMedia[] {
    return this.rows;
  }
}

/** A database that refuses the insert. */
class FailingRepository extends MediaUploadRepository {
  constructor(media: MediaTestEnvironment) {
    super(new DatabaseService(media.config));
  }

  override async create(): Promise<MediaRecord> {
    throw new Error('db down');
  }
}

function usecaseWith(media: MediaTestEnvironment, repository: MediaUploadRepository): MediaUploadUsecase {
  const images = new ImageProcessor(new ImageTypeDetector(), new ImageJobQueue());
  const storage = media.createStorage();
  return new MediaUploadUsecase(images, storage, repository, new MediaObjectCleaner(storage, media.config));
}

async function pngOf(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#c00' } })
    .png()
    .toBuffer();
}

describe('MediaUploadUsecase', () => {
  it('stores the WebP under admin/<owner id>/<uuid>/ and writes owner, location and metadata into the row', async () => {
    const media = new MediaTestEnvironment();
    const repository = new RecordingRepository(media);
    const item = await usecaseWith(media, repository).execute({
      data: await pngOf(32, 16),
      originalName: 'C:\\photos\\Худи.png',
      owner: OWNER,
    });
    const [row] = repository.savedRows();
    strictEqual(row?.stored.key, `admin/${OWNER.ownerId}/${row?.stored.uuid}/image.webp`);
    deepStrictEqual(
      [row.owner, row.stored.bucket, row.stored.url, row.originalName],
      [OWNER, media.bucket, `/media/${row.stored.key}`, 'Худи.png'],
    );
    deepStrictEqual(media.disk.keys(), [row.stored.key]);
    strictEqual((await media.disk.stat(row.stored.key)).contentType, 'image/webp');
    deepStrictEqual(
      [item.mime, item.width, item.height, item.usageCount, item.createdAt],
      ['image/webp', 32, 16, 0, '2026-10-20T12:00:00.000Z'],
    );
  });

  it('gives every upload a new folder', async () => {
    const media = new MediaTestEnvironment();
    const repository = new RecordingRepository(media);
    const usecase = usecaseWith(media, repository);
    await usecase.execute({ data: await pngOf(4, 4), originalName: 'a.png', owner: OWNER });
    await usecase.execute({ data: await pngOf(4, 4), originalName: 'a.png', owner: OWNER });
    const [first, second] = repository.savedRows();
    match(first?.stored.uuid ?? '', /^[0-9a-f-]{36}$/);
    strictEqual(first?.stored.uuid === second?.stored.uuid, false);
  });

  it('deletes the stored file again when the row cannot be written, and fails with the database error', async () => {
    const media = new MediaTestEnvironment();
    const usecase = usecaseWith(media, new FailingRepository(media));
    await rejects(usecase.execute({ data: await pngOf(4, 4), originalName: 'a.png', owner: OWNER }), /db down/);
    deepStrictEqual(media.disk.keys(), []);
  });

  it('never stores a file it could not validate, nor a missing one', async () => {
    const media = new MediaTestEnvironment();
    const repository = new RecordingRepository(media);
    const usecase = usecaseWith(media, repository);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
    await rejects(
      usecase.execute({ data: svg, originalName: 'x.svg', owner: OWNER }),
      (error: unknown) => error instanceof ImageValidationException && error.reason === ImageValidationCode.UNSUPPORTED,
    );
    await rejects(
      usecase.execute({ data: undefined, originalName: undefined, owner: OWNER }),
      MediaFileMissingException,
    );
    deepStrictEqual([media.disk.keys(), repository.savedRows()], [[], []]);
  });

  it('names a file without a usable name "image"', async () => {
    const media = new MediaTestEnvironment();
    const repository = new RecordingRepository(media);
    await usecaseWith(media, repository).execute({ data: await pngOf(4, 4), originalName: undefined, owner: OWNER });
    strictEqual(repository.savedRows()[0]?.originalName, 'image');
  });
});
