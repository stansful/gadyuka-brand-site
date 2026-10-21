import { Injectable } from '@nestjs/common';

import { PUBLIC_LIST_LIMITS } from '~core/public-content/public-content.constants';
import { CollectionPageChanges, ContentLastChanges } from '~core/public-content/sitemap-last-modified';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';

/** One row: the latest updated_at of every table the public pages render (hidden rows included). */
const CONTENT_LAST_CHANGES = Prisma.sql`
  SELECT (SELECT MAX(updated_at) FROM messages) AS "messages",
         (SELECT MAX(updated_at) FROM menu_items) AS "menuItems",
         (SELECT MAX(updated_at) FROM social_links) AS "socialLinks",
         (SELECT MAX(updated_at) FROM site_settings) AS "settings",
         (SELECT MAX(updated_at) FROM content_images) AS "contentImages",
         (SELECT MAX(updated_at) FROM media) AS "media",
         (SELECT MAX(updated_at) FROM reviews) AS "reviews",
         (SELECT MAX(updated_at) FROM news_items) AS "news",
         (SELECT MAX(updated_at) FROM gallery_items) AS "gallery",
         (SELECT MAX(updated_at) FROM offers) AS "offers",
         (SELECT MAX(updated_at) FROM partners) AS "partners",
         (SELECT MAX(updated_at) FROM collections) AS "collections",
         (SELECT MAX(updated_at) FROM products) AS "products"`;

/**
 * Published collections in the admin's order, each with the latest change of what its page renders:
 * the row, its cover, its products (hidden ones too) and the media of their images.
 */
const COLLECTION_PAGES = Prisma.sql`
  SELECT c.slug,
         c.updated_at AS "updatedAt",
         cover.updated_at AS "coverUpdatedAt",
         (SELECT MAX(p.updated_at) FROM products p WHERE p.collection_id = c.id) AS "productsUpdatedAt",
         (SELECT MAX(m.updated_at)
            FROM products p
            JOIN product_images pi ON pi.product_id = p.id
            JOIN media m ON m.id = pi.media_id
           WHERE p.collection_id = c.id) AS "imagesUpdatedAt"
    FROM collections c
    LEFT JOIN media cover ON cover.id = c.cover_id
   WHERE c.published
   ORDER BY c."order" ASC, c.created_at ASC
   LIMIT ${PUBLIC_LIST_LIMITS.sitemapCollections}`;

/**
 * The timestamps sitemap.xml is built from (port of the frontend's getSitemapData queries) as SQL
 * aggregates: the database folds the products and images of a collection instead of loading them.
 */
@Injectable()
export class SitemapRepository {
  constructor(private readonly database: DatabaseService) {}

  async findContentLastChanges(): Promise<ContentLastChanges> {
    const [row] = await this.database.client.$queryRaw<ContentLastChanges[]>(CONTENT_LAST_CHANGES);
    return row;
  }

  findCollectionPages(): Promise<CollectionPageChanges[]> {
    return this.database.client.$queryRaw<CollectionPageChanges[]>(COLLECTION_PAGES);
  }
}
