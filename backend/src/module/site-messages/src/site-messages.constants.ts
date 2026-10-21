/** DI token of the Message rows source (ISiteMessageRows): the database, or an in-memory stub in unit tests. */
export const SITE_MESSAGE_ROWS = Symbol('site-message-rows');

/** DI token of the clock the cache expiry reads (IClock). */
export const SITE_MESSAGES_CLOCK = Symbol('site-messages-clock');

/**
 * How long resolved messages stay cached. Writes of the admin («Тексты сайта») drop the cache at once
 * (SiteMessagesService.invalidate); the expiry only catches writes from outside the app (the seed,
 * manual SQL).
 */
export const SITE_MESSAGES_CACHE_TTL_MS = 5 * 60 * 1000;
