import { getLenis } from "./lenis-store";

/**
 * The page's scroll position and the smooth scroll of the public pages: in-page anchors
 * (SmoothScroll) and a press on the snake's track (chrome/ScrollSpine). No GSAP: importing this
 * pulls in nothing but the Lenis store.
 */

/** Things the visitor does that end a tween and SmoothScroll's deep-link alignment (they are scrolling on their own). */
export const USER_SCROLL_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

/** Duration of an anchor scroll (s), with Lenis and without. */
const ANCHOR_DURATION = 1.5;

const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

/** The page's maximum scroll (reads the layout: once per frame at most, only while a tween runs). */
export function maxScroll(): number {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

export function clampScroll(top: number): number {
  return Math.min(Math.max(0, top), maxScroll());
}

export type ScrollPort = { read: () => number; write: (top: number) => void };

/**
 * The page's scroll position, read and written through Lenis while it runs (it keeps its own and
 * would otherwise animate back to it); written at once, never smoothly — the CSS
 * scroll-behavior: smooth of <html> (noir.css) does not apply to an "instant" scroll.
 */
export const pageScroll: ScrollPort = {
  read: () => getLenis()?.scroll ?? window.scrollY,
  write: (top) => {
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
    else window.scrollTo({ top, behavior: "instant" });
  },
};

export type TweenOptions = {
  /** Seconds (default ANCHOR_DURATION). */
  duration?: number;
  /** A USER_SCROLL_EVENTS event that must not stop the tween (the press that started it). */
  ignore?: (event: Event) => boolean;
  /** Called when the visitor stopped the tween (not when the returned cancel function is called). */
  onInterrupt?: () => void;
};

/**
 * Smooth scroll: the curve of Lenis' scrollTo (easeOutQuart), stopped as soon as the visitor
 * scrolls, taps or presses a key. Returns the cancel function.
 *
 * The target is measured again on every frame (one layout read per frame, only while this
 * runs): the chapters passed on the way are rendered for the first time (content-visibility) and
 * their real height differs from the estimate, which moves everything below them — a target
 * measured once would be missed and need a snap at the end. Each frame covers the share of the
 * REMAINING distance that the curve covers in that frame (1 − ease(t) shrinks by the same
 * ratio), so a moved target (or a scroll-anchoring adjustment) is absorbed smoothly by the rest of
 * the tween, and the last frame lands on it exactly.
 */
export function tweenScroll(port: ScrollPort, target: () => number, onDone: () => void, options: TweenOptions = {}): () => void {
  const { duration = ANCHOR_DURATION, ignore, onInterrupt } = options;
  let frame = 0;
  const stop = (): void => {
    window.cancelAnimationFrame(frame);
    frame = 0;
    for (const type of USER_SCROLL_EVENTS) window.removeEventListener(type, interrupt);
  };
  function interrupt(event: Event): void {
    if (ignore?.(event)) return;
    stop();
    onInterrupt?.();
  }
  if (Math.abs(clampScroll(target()) - port.read()) < 1) {
    onDone();
    return stop;
  }
  let start: number | null = null;
  /** 1 − ease(t) at the previous frame: the share of the way still to go then. */
  let left = 1;
  const step = (now: number): void => {
    start ??= now;
    const t = Math.min(1, (now - start) / (duration * 1000));
    const remaining = 1 - easeOutQuart(t);
    const to = clampScroll(target());
    const at = port.read();
    port.write(t >= 1 || left <= 0 ? to : to - (to - at) * (remaining / left));
    left = remaining;
    if (t < 1) {
      frame = window.requestAnimationFrame(step);
    } else {
      stop();
      onDone();
    }
  };
  frame = window.requestAnimationFrame(step);
  for (const type of USER_SCROLL_EVENTS) window.addEventListener(type, interrupt, { passive: true });
  return stop;
}
