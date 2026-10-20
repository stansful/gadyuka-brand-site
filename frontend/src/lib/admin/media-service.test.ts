import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { deleteObject, putObject } from '@/lib/storage';

import { forgetAdminUserId, getAdminUserId } from './admin-user';
import { createMediaFromUpload } from './media-service';

vi.mock('@/lib/db', () => ({
  db: {
    media: { create: vi.fn() },
    user: { findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock('next-intl/server', async () => (await import('../../../test/admin-intl')).nextIntlServerMock);
vi.mock('@/lib/storage', () => ({
  putObject: vi.fn(async () => ({ etag: '"etag"' })),
  deleteObject: vi.fn(async () => undefined),
  getMediaBucket: vi.fn(() => 'test-media'),
}));

const ADMIN_ID = 'cmh1x2y3z0000abcd1234efgh';

type CreateArgs = { data: Record<string, unknown> };

/** First argument of the last db.media.create call. */
function lastCreateData(): Record<string, unknown> {
  const call = vi.mocked(db.media.create).mock.lastCall as unknown as [CreateArgs] | undefined;
  if (!call) throw new Error('db.media.create was not called');
  return call[0].data;
}

async function upload(): Promise<Uint8Array> {
  const png = await sharp({ create: { width: 32, height: 16, channels: 3, background: '#c00' } })
    .png()
    .toBuffer();
  return new Uint8Array(png);
}

describe('createMediaFromUpload', () => {
  beforeEach(() => {
    forgetAdminUserId();
    vi.mocked(db.user.findFirst).mockImplementation((async () => ({ id: ADMIN_ID })) as never);
    vi.mocked(db.media.create).mockImplementation((async (args: CreateArgs) => ({
      id: 'media1',
      url: args.data.url,
      width: args.data.width,
      height: args.data.height,
      alt: {},
      mime: args.data.mime,
      size: args.data.size,
      originalName: args.data.originalName,
      createdAt: new Date('2026-10-20T12:00:00Z'),
      _count: {
        contentImages: 0,
        collectionCovers: 0,
        productImages: 0,
        reviewAvatars: 0,
        newsImages: 0,
        galleryItems: 0,
        offerImages: 0,
        partnerLogos: 0,
        ogImageSettings: 0,
      },
    })) as never);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('stores the WebP under admin/<ownerId>/<uuid>/ and writes the owner and location into the row', async () => {
    const media = await createMediaFromUpload({ data: await upload(), originalName: 'C:\\photos\\Худи.png' });

    const data = lastCreateData();
    expect(data).toMatchObject({
      ownerType: 'ADMIN',
      ownerId: ADMIN_ID,
      bucket: 'test-media',
      mime: 'image/webp',
      width: 32,
      height: 16,
      originalName: 'Худи.png',
    });
    expect(data.key).toBe(`admin/${ADMIN_ID}/${String(data.uuid)}/image.webp`);
    expect(data.url).toBe(`/media/${String(data.key)}`);
    expect(vi.mocked(putObject)).toHaveBeenCalledWith(expect.objectContaining({ key: data.key }));
    expect(media).toMatchObject({ id: 'media1', url: data.url, usageCount: 0, mime: 'image/webp' });
  });

  it('deletes the uploaded object when the insert fails', async () => {
    vi.mocked(db.media.create).mockRejectedValueOnce(new Error('db down'));
    await expect(createMediaFromUpload({ data: await upload(), originalName: 'a.png' })).rejects.toThrow('db down');
    const data = lastCreateData();
    expect(vi.mocked(deleteObject)).toHaveBeenCalledWith(data.key, 'test-media');
  });

  it('looks the ADMIN user up again after an ownerId foreign key failure', async () => {
    const stale = new Prisma.PrismaClientKnownRequestError('Foreign key constraint violated', {
      code: 'P2003',
      clientVersion: '7.10.1',
    });
    vi.mocked(db.media.create).mockRejectedValueOnce(stale);
    await expect(createMediaFromUpload({ data: await upload(), originalName: 'a.png' })).rejects.toBe(stale);
    await createMediaFromUpload({ data: await upload(), originalName: 'a.png' });
    expect(vi.mocked(db.user.findFirst)).toHaveBeenCalledTimes(2);
  });

  it('never stores a file it could not validate', async () => {
    await expect(
      createMediaFromUpload({ data: new TextEncoder().encode('<svg/>'), originalName: 'x.svg' }),
    ).rejects.toMatchObject({ code: 'unsupported' });
    expect(vi.mocked(putObject)).not.toHaveBeenCalled();
    expect(vi.mocked(db.media.create)).not.toHaveBeenCalled();
  });
});

describe('getAdminUserId', () => {
  beforeEach(() => {
    forgetAdminUserId();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('creates the ADMIN user when the seed has not, once for parallel callers', async () => {
    vi.mocked(db.user.findFirst).mockImplementation((async () => null) as never);
    vi.mocked(db.user.create).mockImplementation((async () => ({ id: 'new-admin' })) as never);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const ids = await Promise.all([getAdminUserId(), getAdminUserId()]);
    expect(ids).toEqual(['new-admin', 'new-admin']);
    expect(vi.mocked(db.user.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.user.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'ADMIN', name: 'Администратор' } }),
    );
    expect(await getAdminUserId()).toBe('new-admin');
    expect(vi.mocked(db.user.findFirst)).toHaveBeenCalledTimes(1);
  });

  it('retries the lookup after a failure', async () => {
    vi.mocked(db.user.findFirst)
      .mockImplementationOnce((async () => Promise.reject(new Error('db down'))) as never)
      .mockImplementationOnce((async () => ({ id: ADMIN_ID })) as never);
    await expect(getAdminUserId()).rejects.toThrow('db down');
    expect(await getAdminUserId()).toBe(ADMIN_ID);
  });
});
