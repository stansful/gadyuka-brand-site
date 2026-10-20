import { loadedScrollTrigger, type ScrollTriggerPlugin } from "./gsap";
import { LITE_CLASS } from "./in-app";
import { refreshDecision } from "./refresh-gate";

/**
 * Motion environment (client only).
 *
 * `html.motion` is added by the inline head script (src/app/[locale]/layout.tsx) when the
 * visitor does not prefer reduced motion. Every animation module checks motionEnabled()
 * first; without it (reduced motion, JS failure) the server-rendered page stays as is:
 * fully visible, native scrolling, no scrub.
 */

export const MOTION_CLASS = "motion";
/** Set by INTRO_BOOT (boot.ts) while the cover's CSS intro runs; removed by the hero scene. */
export const INTRO_CLASS = "is-intro";
/**
 * Set by MOTION_BOOT (boot.ts) together with `motion`: the scroll scenes' start states are drawn
 * by CSS (noir.css, "scene start states") for every scene root still marked SCENE_PENDING_ATTR,
 * so content is never painted finished and then hidden again. Only a failsafe removes the
 * class (4 s after `load`, when the app bundle or the scroll plugins have not arrived by then);
 * the scenes clear their own marks.
 */
export const PENDING_CLASS = "motion-pending";

export { SCENE_LATE_ATTR, SCENE_PENDING_ATTR } from "./scene-attrs";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_QUERY).matches;
}

export function motionEnabled(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains(MOTION_CLASS) && !prefersReducedMotion();
}

/**
 * In-app browsers (in-app.ts, set before first paint by MOTION_BOOT together with `motion`): the
 * scroll scenes are not set up (ScrollTrigger is never loaded) — CSS loops, the cover intro and
 * motion/lite.ts only.
 */
export function liteMotion(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains(LITE_CLASS);
}

/** Mouse / trackpad (tilt, cursor bubble); touch screens get the "lit when centred" variant. */
export function hasFinePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

let refreshTimer: number | undefined;
/** Fingers on the screen now (TouchEvent.touches of the last touch event). */
let activeTouches = 0;
/** performance.now() of the last touch start / end or scroll event. */
let lastActivity = 0;
let tracking = false;
/** A finger has touched the page (a hybrid device whose primary pointer is fine scrolls by touch too). */
let touchSeen = false;

/**
 * What refresh-gate.ts treats as a touch screen: touch is the primary input, or the visitor has
 * touched the page (an iPad with a trackpad, a touch laptop — their touch scrolling has the same
 * compositor momentum, Lenis only smooths the wheel).
 */
export function isTouchScreen(): boolean {
  return typeof window !== "undefined" && (touchSeen || !hasFinePointer());
}

/**
 * Starts following the visitor's touches and scrolling (once, for the page's lifetime: passive
 * listeners that only store a number) — refresh-gate.ts decides from them when a ScrollTrigger
 * refresh can run on a touch screen without undoing a swipe. SmoothScroll calls it on mount, so the
 * swipes before the first refresh request count too.
 */
export function trackScrollActivity(): void {
  if (tracking || typeof window === "undefined") return;
  tracking = true;
  const onTouch = (event: TouchEvent): void => {
    touchSeen = true;
    activeTouches = event.touches.length;
    lastActivity = performance.now();
  };
  // A touch's end goes to its start target only: if that node left the DOM meanwhile (the
  // lightbox swaps its <img> on a swipe), window never sees it — so the target is listened to as
  // well (a detached node still gets it). Counting the same end twice does no harm.
  const onTouchStart = (event: TouchEvent): void => {
    onTouch(event);
    const target = event.target;
    if (!(target instanceof Node)) return;
    const done = new AbortController();
    const onEnd = (end: Event): void => {
      if (end instanceof TouchEvent) onTouch(end);
      done.abort();
    };
    target.addEventListener("touchend", onEnd, { passive: true, signal: done.signal });
    target.addEventListener("touchcancel", onEnd, { passive: true, signal: done.signal });
  };
  const onScroll = (): void => {
    lastActivity = performance.now();
  };
  const options = { passive: true, capture: true } as const;
  window.addEventListener("touchstart", onTouchStart, options);
  window.addEventListener("touchend", onTouch, options);
  window.addEventListener("touchcancel", onTouch, options);
  window.addEventListener("scroll", onScroll, { passive: true });
}

/** Called after a touch screen's re-measure (refreshEach) — ScrollTrigger dispatches "refresh" only for a full one. */
const refreshedListeners = new Set<() => void>();

/** Subscribes to the touch-screen re-measures; returns the unsubscribe. */
export function onRefreshed(listener: () => void): () => void {
  refreshedListeners.add(listener);
  return () => refreshedListeners.delete(listener);
}

/**
 * Touch screens: every trigger re-measures itself — never ScrollTrigger.refresh(). A full refresh
 * measures by scrolling the window to 0 and back; in Telegram's in-app browser (an Android
 * WebView with Chrome's user agent — not detectable) that instant at 0 is seen by the app, which
 * then threw the visitor's next swipe thousands of px away (measured on a phone: +8020 px in one
 * frame under the finger, right after a full refresh at rest). A trigger's own refresh() reads its
 * position at the current scroll and writes nothing — as long as no trigger pins (none does: a pin
 * would need the full refresh, ScrollTrigger queues one itself then).
 */
function refreshEach(scrollTrigger: ScrollTriggerPlugin): void {
  for (const trigger of scrollTrigger.getAll()) trigger.refresh();
  scrollTrigger.update();
  for (const listener of refreshedListeners) listener();
}

function runRefresh(): void {
  const scrollTrigger = loadedScrollTrigger();
  if (!scrollTrigger) return;
  const decision = refreshDecision({
    touch: isTouchScreen(),
    activeTouches,
    stillForMs: performance.now() - lastActivity,
    hidden: document.hidden,
  });
  if (decision.kind === "wait") refreshTimer = window.setTimeout(runRefresh, decision.ms);
  else if (decision.kind === "now") refreshEach(scrollTrigger);
  else scrollTrigger.refresh(true);
}

/**
 * Coalesces ScrollTrigger refreshes (page height changes, `load`, the end of the cover intro);
 * nothing to do before it loaded. Never while the page is moving:
 *  - mouse / trackpad: GSAP's safe refresh — refresh(true) waits for its scrollEnd;
 *  - touch screens: only once the page has been still (no finger, no scroll, momentum included)
 *    for TOUCH_STILL_MS (refresh-gate.ts), and then trigger by trigger, with no scroll written
 *    at all (refreshEach).
 */
export function scheduleRefresh(): void {
  if (typeof window === "undefined") return;
  trackScrollActivity();
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(runRefresh, 120);
}
