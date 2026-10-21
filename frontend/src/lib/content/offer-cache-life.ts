/** A cacheLife profile as an object (cacheLife({ stale, revalidate, expire }), seconds). */
export type CacheLifeProfile = { stale: number; revalidate: number; expire: number };

/** Values of the "hours" profile (CONTENT_CACHE_LIFE, ./cache.ts), for the shortened inline variant. */
const HOURS_PROFILE = { stale: 300, revalidate: 3600, expire: 86_400 } as const;
/** Never regenerate more often than this for an upcoming offer end. */
const MIN_OFFER_REVALIDATE_SECONDS = 60;

/**
 * Landing cache lifetime when a visible offer ends before the regular hourly revalidation: nothing
 * invalidates the cache when an offer's validUntil passes, so revalidate right after the earliest
 * end (`expiresAt` = the backend's LandingResponse.offersExpireAt) and the next request after it
 * regenerates the page without the ended offer. null = the regular "hours" profile applies.
 */
export function offerExpiryCacheLife(expiresAt: string | null, now: Date): CacheLifeProfile | null {
  if (expiresAt === null) return null;
  const at = Date.parse(expiresAt);
  if (Number.isNaN(at)) return null;
  const secondsLeft = Math.ceil((at - now.getTime()) / 1000) + 1;
  if (secondsLeft >= HOURS_PROFILE.revalidate) return null;
  return { ...HOURS_PROFILE, revalidate: Math.max(MIN_OFFER_REVALIDATE_SECONDS, secondsLeft) };
}
