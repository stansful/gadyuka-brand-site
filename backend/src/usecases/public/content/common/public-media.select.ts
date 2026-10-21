import { Prisma } from '~prisma-generated/prisma/client';

/** The media columns of every picture the public site renders (an ImageRef). */
export const PUBLIC_MEDIA_SELECT = {
  id: true,
  url: true,
  width: true,
  height: true,
  mime: true,
  alt: true,
} satisfies Prisma.MediaSelect;

/** A media row as PUBLIC_MEDIA_SELECT reads it (`alt` is the stored LocalizedText JSON). */
export interface PublicMediaRow {
  readonly id: string;
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly mime: string;
  readonly alt: unknown;
}

/** An `orderBy` of the columns every orderable list has. */
export type ListOrder = Array<{ order?: Prisma.SortOrder; createdAt?: Prisma.SortOrder }>;

/** The admin's manual order of a list (ties: the older row first). */
export const MANUAL_ORDER: ListOrder = [{ order: 'asc' }, { createdAt: 'asc' }];
