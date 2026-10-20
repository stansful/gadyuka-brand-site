/**
 * The tap guard's numbers and what it publishes on `window`. The guard itself is an inline script
 * of MOTION_BOOT (boot.ts TAP_GUARD, from the first script of every public page); this module stays
 * tiny so client code can read the same state without pulling the inline scripts in.
 */

/** A touch that lands within this long (ms) of a scroll frame catches the page still moving. */
export const TAP_MOVING_MS = 150;
/**
 * A scroll frame shorter than this (px) does not count as moving: the last half second of an anchor
 * tween (easeOutQuart, scroll-tween.ts) and a snap settling move a pixel or two per frame — the
 * page looks still, and a tap there is meant.
 */
export const TAP_MOVE_MIN_PX = 2;
/** Scrolled more than this (px) between the finger landing and lifting: a swipe, not a tap. */
export const TAP_SLOP_PX = 8;
/** The finger travelled more than this (px) before it lifted: a swipe, not a tap (any browser's tap slop is smaller). */
export const TAP_TRAVEL_PX = 24;
/** A click (or its compatibility mousedown) this long (ms) after the last touchend is not that touch's tap. */
export const TAP_AFTER_END_MS = 700;
/**
 * A touchstart handled this late (ms) after the finger landed: the main thread was busy (hydration,
 * a chapter's first render) and no scroll frame reached it meanwhile, while the compositor may have
 * kept a fling going — the moving window then grows by the delay plus TAP_STALL_MARGIN_MS.
 */
export const TAP_STALL_MS = 50;
export const TAP_STALL_MARGIN_MS = 300;

/** The page is moving now (a root scroll frame of TAP_MOVE_MIN_PX or more within TAP_MOVING_MS), as the tap guard sees it. */
export function pageMoving(): boolean {
  const at = window.__gadyukaScrollAt;
  return at !== undefined && performance.now() - at < TAP_MOVING_MS;
}

/** The visitor has touched, pressed, used the wheel or a key since the page opened — from its first script, before hydration. */
export function visitorActed(): boolean {
  return window.__gadyukaInput === true;
}

declare global {
  interface Window {
    /** performance.now() of the last root scroll frame that moved the page (TAP_GUARD). */
    __gadyukaScrollAt?: number;
    /** Set by MOTION_BOOT on the visitor's first touch / pointer press / wheel / key. */
    __gadyukaInput?: boolean;
    /** Clicks cancelled by the tap guard (the ?diag=1 overlay shows it). */
    __gadyukaTapsBlocked?: number;
  }
}
