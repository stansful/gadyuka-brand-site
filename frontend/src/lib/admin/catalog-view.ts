import type { EntityRow } from './types';

/** View models of the catalog pages (collections, products) — isomorphic types. */

/** A collection in the product form's select (title already in the admin language). */
export type CollectionOption = { id: string; slug: string; title: string };

/** One collection of the products page with its product rows. */
export type ProductGroup = { collection: CollectionOption & { published: boolean }; rows: EntityRow[] };
