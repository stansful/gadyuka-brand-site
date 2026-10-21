import { MAX_REORDER_IDS } from '~core/entities/entity-order.constants';

/** Sort of the catalog lists: the site's order (manual `order`, then creation time). */
export const CATALOG_LIST_ORDER: Array<{ order?: 'asc'; createdAt?: 'asc' }> = [{ order: 'asc' }, { createdAt: 'asc' }];

/**
 * Most rows of one admin list (a drag & drop list is never paginated; it shows at most what one
 * reorder request may carry).
 */
export const CATALOG_LIST_LIMIT = MAX_REORDER_IDS;
