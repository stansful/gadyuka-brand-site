import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { Prisma } from '~prisma-generated/prisma/client';

import { MediaRecord } from './media-record';

/** Every relation that references a media row (a file is in use while any of them counts > 0). */
const USAGE_COUNT_SELECT = {
  contentImages: true,
  collectionCovers: true,
  productImages: true,
  reviewAvatars: true,
  newsImages: true,
  galleryItems: true,
  offerImages: true,
  partnerLogos: true,
  ogImageSettings: true,
} satisfies Prisma.MediaCountOutputTypeSelect;

const MEDIA_RECORD_SELECT = {
  id: true,
  url: true,
  width: true,
  height: true,
  alt: true,
  mime: true,
  size: true,
  originalName: true,
  createdAt: true,
  _count: { select: USAGE_COUNT_SELECT },
} satisfies Prisma.MediaSelect;

export type MediaRecordRow = Prisma.MediaGetPayload<{ select: typeof MEDIA_RECORD_SELECT }>;
export type MediaUsageCounts = MediaRecordRow['_count'];

/** Media rows → MediaRecord (port of toAdminMedia of the frontend's media-service.ts). */
export class MediaRecordMapper {
  /** The select of a MediaRecord row (usage counts included). */
  static readonly SELECT = MEDIA_RECORD_SELECT;
  /** The `_count` select of every relation that references a file. */
  static readonly USAGE_COUNT_SELECT = USAGE_COUNT_SELECT;

  static toRecord(row: MediaRecordRow): MediaRecord {
    const { _count: counts, alt, ...fields } = row;
    return {
      ...fields,
      alt: LocalizedTextValue.from(alt).toTranslations(),
      usageCount: MediaRecordMapper.sum(counts),
    };
  }

  /** Sum of the references of every relation. */
  static sum(counts: MediaUsageCounts): number {
    return Object.values(counts).reduce((total, count) => total + count, 0);
  }
}
