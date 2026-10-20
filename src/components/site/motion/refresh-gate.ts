/**
 * When a full ScrollTrigger refresh may run (env.ts scheduleRefresh) — pure, so it is unit-tested.
 *
 * A full refresh measures by scrolling the window to 0 and back to the position it recorded when
 * it started (gsap ScrollTrigger _refreshAll). On a touch screen the page scrolls on the
 * compositor, independently of the main thread: a swipe — or the momentum of the last one — that
 * moves the page while the refresh runs is undone by that restore, and the page jumps back.
 * Measured on a real Android phone (Chrome Custom Tabs, Telegram's in-app browser): 543 px jumps
 * while late images and fonts changed the page height mid-scroll. GSAP's own "safe" refresh
 * (refresh(true): wait for its scrollEnd) was not enough there — the next swipe started while the
 * refresh ran. So on touch screens a refresh only runs once the page has been still — no finger
 * on the screen, no scroll event — for TOUCH_STILL_MS, and small height changes skip it entirely.
 * Mouse / trackpad keep GSAP's safe refresh (Lenis drives the scroll there, no compositor fling).
 */

/** How long a touch screen's page must be still — no touch, no scroll (fling included) — before a refresh (ms). */
export const TOUCH_STILL_MS = 1000;

/**
 * Touch screens: a document-height change smaller than this (px, counted from the height of the
 * last refresh) does not ask for one — the reveals below it fire a few px off, which nobody sees,
 * while every refresh is a chance to undo a swipe.
 */
export const TOUCH_MIN_HEIGHT_DELTA = 96;

export type RefreshDecision =
  /** Mouse / trackpad: GSAP's refresh(true). */
  | { kind: 'safe' }
  /** Touch screen, page still: refresh() right away. */
  | { kind: 'now' }
  /** Touch screen, not still yet (or hidden): look again in `ms`. */
  | { kind: 'wait'; ms: number };

export type RefreshState = {
  /** Touch is the primary input (no hover + fine pointer). */
  touch: boolean;
  /** Fingers on the screen now. */
  activeTouches: number;
  /** Time since the last touch start / end or scroll event (ms). */
  stillForMs: number;
  /** document.hidden — measure when the page is back. */
  hidden: boolean;
};

export function refreshDecision({ touch, activeTouches, stillForMs, hidden }: RefreshState): RefreshDecision {
  if (!touch) return { kind: 'safe' };
  if (activeTouches > 0 || hidden) return { kind: 'wait', ms: TOUCH_STILL_MS };
  if (stillForMs < TOUCH_STILL_MS) return { kind: 'wait', ms: Math.max(150, Math.ceil(TOUCH_STILL_MS - stillForMs)) };
  return { kind: 'now' };
}

/** Whether a document-height change asks for a refresh (`refreshedHeight`: the height the last one measured). */
export function heightChangeNeedsRefresh(touch: boolean, height: number, refreshedHeight: number): boolean {
  return !touch || Math.abs(height - refreshedHeight) >= TOUCH_MIN_HEIGHT_DELTA;
}
