import { Injectable } from '@nestjs/common';

import { UserRole } from '~core/users/user-role';
import { DatabaseService } from '~database';

/** The Media row of a seed image, as far as the seed needs it. */
export interface StoredSeedMedia {
  readonly id: string;
  readonly key: string;
  readonly bucket: string;
}

/** Where a seed image's object lives. */
export interface SeedMediaLocation {
  readonly bucket: string;
  readonly key: string;
  readonly url: string;
}

/** The stored file of a seed image. */
export interface SeedMediaFile {
  readonly mime: string;
  readonly width: number;
  readonly height: number;
  readonly size: number;
  readonly originalName: string;
}

/** A seed image row to create or refresh (by its derived uuid). Never carries alt: MediaAltSeed sets it. */
export interface SeedMediaRow {
  readonly ownerId: string;
  readonly uuid: string;
  readonly location: SeedMediaLocation;
  readonly file: SeedMediaFile;
}

/** The newest row of an owner's file name whose uuid has the given version. */
export interface SeedMediaHistoryQuery {
  readonly ownerId: string;
  readonly originalName: string;
  /** Version nibble of the uuid ("8") */
  readonly uuidVersion: string;
}

@Injectable()
export class SeedMediaRepository {
  /** Character of the version nibble in the canonical uuid text (1-based, SQL substr). */
  private static readonly UUID_VERSION_POSITION = 15;

  constructor(private readonly database: DatabaseService) {}

  findByUuid(uuid: string): Promise<StoredSeedMedia | null> {
    return this.database.client.media.findUnique({ where: { uuid }, select: { id: true, key: true, bucket: true } });
  }

  async findLatestOfVersion(query: SeedMediaHistoryQuery): Promise<StoredSeedMedia | null> {
    const rows = await this.database.client.$queryRaw<StoredSeedMedia[]>`
      SELECT id::text AS id, key, bucket FROM media
      WHERE owner_id = ${query.ownerId}::uuid AND original_name = ${query.originalName}
        AND substr(uuid::text, ${SeedMediaRepository.UUID_VERSION_POSITION}::int, 1) = ${query.uuidVersion}
      ORDER BY created_at DESC, id DESC
      LIMIT 1`;
    return rows[0] ?? null;
  }

  /** Creates the row of `uuid`, or refreshes its file fields; returns Media.id. */
  async upsert({ ownerId, uuid, location, file }: SeedMediaRow): Promise<string> {
    const fields = { ...location, ...file };
    const row = await this.database.client.media.upsert({
      where: { uuid },
      create: { ownerType: UserRole.ADMIN, ownerId, uuid, ...fields },
      update: fields,
      select: { id: true },
    });
    return row.id;
  }
}
