import type { MediaRef } from '~shared/contracts/common';

import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { Prisma } from '~prisma-generated/prisma/client';

/** The columns of a Media row a thumbnail needs (`select` of a relation: `cover: { select: MediaRefRecord.SELECT }`). */
const MEDIA_REF_SELECT = {
  id: true,
  url: true,
  width: true,
  height: true,
  alt: true,
} as const satisfies Prisma.MediaSelect;

export type MediaRefRow = Prisma.MediaGetPayload<{ select: typeof MEDIA_REF_SELECT }>;

/** Reads the media references of admin rows (repositories): the stored public URL, the alt texts. */
export class MediaRefRecord {
  static readonly SELECT = MEDIA_REF_SELECT;

  static toMediaRef({ id, url, width, height, alt }: MediaRefRow): MediaRef {
    return { id, url, width, height, alt: LocalizedTextValue.parse(alt) };
  }

  static toNullableMediaRef(row: MediaRefRow | null): MediaRef | null {
    return row === null ? null : MediaRefRecord.toMediaRef(row);
  }
}
