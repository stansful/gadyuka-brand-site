'use client';

import { type ReactElement, useEffect, useLayoutEffect, useRef } from 'react';

import { hasFinePointer, motionEnabled } from '../motion/env';
import { pageScroll, tweenScroll } from '../motion/scroll-tween';
import { pageMoving } from '../motion/tap-guard';
import { SCROLLBAR_CLASS, SCROLLBAR_READY_CLASS, SNAKE_OFF_CLASS } from './snake-bar';
import { dragScroll, grabOffset, scrollProgress, type SpineTrack, stillPress, TOUCH_HOLD_MS } from './spine-math';

const WAVE =
  'M12 0 C22 25 22 25 12 50 S2 75 12 100 S22 125 12 150 S2 175 12 200 S22 225 12 250 S2 275 12 300 S22 325 12 350 S2 375 12 400 S22 425 12 450 S2 475 12 500';

function Wave(): ReactElement {
  return (
    <svg className="spine__wave" viewBox="0 0 24 500" preserveAspectRatio="none" focusable="false">
      <path d={WAVE} />
    </svg>
  );
}

/** noir.css: the slither and the tongue flick are paused (touch screens, between scrolls). */
const IDLE_CLASS = 'is-idle';
/** How long after the last scroll event the snake comes to rest on a touch screen (ms). */
const REST_MS = 250;
/** noir.css: the page does not scroll — no snake (and nothing to drag). */
const FLAT_CLASS = 'is-flat';
/** noir.css: the snake is held (drawn as on hover). */
const HELD_CLASS = 'is-held';
/** noir.css: on <html> while the snake is held — no text selection, the grabbing cursor everywhere. */
const DRAG_CLASS = 'spine-drag';
/** A press on the track glides the page there in this time (s): the anchor tween, shorter. */
const TRACK_GLIDE_S = 0.7;
/**
 * noir.css «SCROLL SPINE», the same media query: the hit areas of touch screens. The track there
 * takes no touches at all and the head lets the browser pan (touch-action: pan-y) — a finger takes
 * it only after holding it still for TOUCH_HOLD_MS.
 */
const TOUCH_HITS_QUERY = '(hover: none), (pointer: coarse)';

/** iPhone / iPad (iPadOS Safari poses as a Mac, but has touch points): WebKit's touch scrolling rules. */
function isWebKitTouch(): boolean {
  const ua = navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** noir.css draws the progress itself where this holds (the same @supports: scroll-driven CSS animations). */
function cssDrawsProgress(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports('animation-timeline', 'scroll()');
}

/** A pointer holding the snake: its id, whether it is a finger, its last viewport y, and where it holds the head (px below its centre). */
type Hold = { id: number; touch: boolean; y: number; offset: number; gliding: boolean };
/** A finger on the head of a touch screen, not holding it yet: where it went down, where it is, the hold timer. */
type Press = { id: number; x: number; y: number; lastY: number; timer: number };

/**
 * The page's scrollbar: a slithering snake along the right edge, its head (with the flicking red
 * tongue) at the reading progress. noir.css hides the native scrollbar of the public pages under
 * html.snake-bar (snake-bar.ts; without JS the native one stays and the snake is not drawn, and
 * MOTION_BOOT gives it back if this script never runs). Hidden while the page does not scroll.
 *
 * Progress — scrollTop / max scroll, the head's position along the spine. Where the browser has
 * scroll timelines, noir.css draws it (scroll-driven animations of the fill's clip-path and the
 * head's translate): from the first paint, before hydration, with no script while scrolling.
 * Elsewhere one rAF-throttled scroll handler here draws it.
 *
 * Scrollbar — the head is the thumb: dragged (mouse, pen, touch; pointer capture) it scrolls the
 * page 1:1 along the track, held where it was grabbed. A mouse / pen press on the track glides the
 * page there (the anchor tween, 0.7 s; at once with reduced motion) and, held, carries on as a
 * drag. On a touch screen a finger takes the head only after holding it still (TOUCH_HOLD_MS): a
 * swipe that merely starts on the head, and any touch on the track, is the page's own scroll —
 * grabbed at once, a thumb swiping or resting near the right edge threw the page many screens away
 * (measured in an Android WebView: Telegram's in-app browser). Scrolls
 * are written once per frame, through Lenis while it runs (immediate) or window.scrollTo
 * (instant), so ScrollTrigger and the menu's scroll spy follow as for any scroll. A hold ends with
 * its pointer's release, its cancel (which also stops the track's glide: the OS took the touch),
 * a move without the button (a release the page never saw), a blur, a hidden page or a context
 * menu. The hit areas (noir.css .spine__rail / .spine__grip) stay in the side gutter on touch
 * screens. Decorative for assistive tech (aria-hidden, nothing focusable): keyboard, wheel and
 * touch scrolling are the page's own.
 *
 * Nothing forces a layout: the track's rect, its length and the maximum scroll are cached and
 * re-measured by ResizeObservers (their callbacks run after layout); scroll and pointer handlers
 * read only the scroll position and the pointer's coordinates.
 */
export function ScrollSpine(): ReactElement {
  const spineRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLSpanElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const gripRef = useRef<HTMLSpanElement>(null);

  // MOTION_BOOT has already swapped the native scrollbar for the snake on a server-rendered page;
  // a page the client renders on its own (not-found, the error boundary) gets it here, before
  // its first paint — and so does a page whose failsafe gave the native one back meanwhile. The
  // ready mark keeps that failsafe from doing so.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (root.classList.contains(SNAKE_OFF_CLASS)) return; // ?snake=0 (diagnostics, MOTION_BOOT)
    root.classList.add(SCROLLBAR_CLASS, SCROLLBAR_READY_CLASS);
  }, []);

  // Touch screens: the slither and the flick (infinite CSS animations on a fixed element — never
  // paused off screen) run only while the page scrolls, so an idle page draws no frame for them
  // (in an Android WebView the compositor is the host app's). One timer per scroll, not per
  // scroll event: it re-arms itself for what is left of the rest period.
  useEffect(() => {
    const spine = spineRef.current;
    if (!spine || hasFinePointer()) return;
    let timer = 0;
    let lastScroll = 0;
    const rest = (): void => {
      const left = REST_MS - (performance.now() - lastScroll);
      if (left > 0) {
        timer = window.setTimeout(rest, left);
        return;
      }
      timer = 0;
      spine.classList.add(IDLE_CLASS);
    };
    const onScroll = (): void => {
      lastScroll = performance.now();
      if (timer !== 0) return;
      spine.classList.remove(IDLE_CLASS);
      timer = window.setTimeout(rest, REST_MS);
    };
    spine.classList.add(IDLE_CLASS);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      spine.classList.remove(IDLE_CLASS);
    };
  }, []);

  useEffect(() => {
    const spine = spineRef.current;
    const fill = fillRef.current;
    const head = headRef.current;
    const rail = railRef.current;
    const grip = gripRef.current;
    if (!spine || !fill || !head || !rail || !grip) return;
    const root = document.documentElement;
    const touchHits = window.matchMedia(TOUCH_HITS_QUERY);
    const webkitTouch = isWebKitTouch();

    // ── Geometry (cached) ────────────────────────────────────────────────────────────────
    let track: SpineTrack = { top: 0, length: 0 };
    let max = 0;

    // ── Progress (where noir.css does not draw it) ───────────────────────────────────────
    const cssProgress = cssDrawsProgress();
    let drawFrame = 0;
    let scrollTop = pageScroll.read();
    const draw = (): void => {
      drawFrame = 0;
      const p = scrollProgress(scrollTop, max);
      fill.style.clipPath = `inset(0 0 ${((1 - p) * 100).toFixed(2)}% 0)`;
      head.style.transform = `translate3d(0, ${(p * track.length).toFixed(1)}px, 0)`;
    };
    const scheduleDraw = (): void => {
      if (drawFrame === 0) drawFrame = window.requestAnimationFrame(draw);
    };
    const onScroll = (): void => {
      scrollTop = pageScroll.read();
      scheduleDraw();
    };
    if (!cssProgress) window.addEventListener('scroll', onScroll, { passive: true });

    // ── Dragging ─────────────────────────────────────────────────────────────────────────
    let hold: Hold | null = null;
    let press: Press | null = null;
    /** Where a press on the track glides to (viewport y; it follows the pointer while held). */
    let glideY = 0;
    let stopGlide = (): void => undefined;
    let pending: { y: number; offset: number } | null = null;
    let writeFrame = 0;
    const write = (): void => {
      writeFrame = 0;
      if (!pending) return;
      pageScroll.write(dragScroll(track, pending.y, pending.offset, max));
      pending = null;
    };
    const scheduleWrite = (y: number, offset: number): void => {
      pending = { y, offset };
      if (writeFrame === 0) writeFrame = window.requestAnimationFrame(write);
    };

    const measure = (): void => {
      const rect = spine.getBoundingClientRect();
      track = { top: rect.top, length: rect.height };
      max = Math.max(0, root.scrollHeight - window.innerHeight);
      spine.classList.toggle(FLAT_CLASS, max < 1);
      if (!cssProgress) onScroll();
      // The page grew or shrank under a dragging pointer (chapters rendered for the first time):
      // the head stays under it.
      if (hold && !hold.gliding) scheduleWrite(hold.y, hold.offset);
    };

    /**
     * The page glides to the track at viewport y (at once with reduced motion). `held` (a mouse /
     * pen still pressing) carries on as a drag once it lands; the glide then follows its pointer.
     */
    const glideTo = (y: number, held: Hold | null): void => {
      if (!motionEnabled()) {
        if (held) held.gliding = false;
        scheduleWrite(y, 0);
        return;
      }
      glideY = y;
      const landed = (): void => {
        if (held) held.gliding = false;
      };
      stopGlide = tweenScroll(pageScroll, () => dragScroll(track, glideY, 0, max), landed, {
        duration: TRACK_GLIDE_S,
        // the press that started it (pointerdown, then touchstart on a touch screen) does not stop it
        ignore: e =>
          (e.type === 'pointerdown' || e.type === 'touchstart') && e.target instanceof Node && spine.contains(e.target),
        onInterrupt: landed,
      });
    };

    const release = (): void => {
      if (!hold) return;
      hold = null;
      root.classList.remove(DRAG_CLASS);
      spine.classList.remove(HELD_CLASS);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      window.removeEventListener('blur', release);
      window.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    function onPointerMove(event: PointerEvent): void {
      if (!hold || event.pointerId !== hold.id) return;
      // A mouse / pen moving with its button up: its release went elsewhere (a context menu took
      // it, it happened outside the window) — the hold is over, the page must not follow the hover.
      if (event.pointerType !== 'touch' && (event.buttons & 1) === 0) {
        release();
        return;
      }
      hold.y = event.clientY;
      if (hold.gliding) glideY = event.clientY;
      else scheduleWrite(event.clientY, hold.offset);
    }
    function onPointerEnd(event: PointerEvent): void {
      if (!hold || event.pointerId !== hold.id) return;
      // Cancelled: the browser or the OS took the pointer (an edge gesture, an incoming call, palm
      // rejection) — the press on the track did not happen, the page does not glide on.
      if (event.type === 'pointercancel') stopGlide();
      release();
    }
    function onContextMenu(event: MouseEvent): void {
      // A finger held still on the head (Android's long press): no menu over the snake, the drag
      // goes on. A mouse / pen: the menu takes the button's release — let go now.
      if (hold?.touch) event.preventDefault();
      else release();
    }
    function onVisibilityChange(): void {
      if (document.visibilityState === 'hidden') release();
    }

    /** Takes the head: from now on the pointer drags the page (window listeners, capture). */
    const startHold = (
      pointerId: number,
      touch: boolean,
      y: number,
      gliding: boolean,
      offset: number,
      captor: Element,
    ): Hold => {
      const current: Hold = { id: pointerId, touch, y, offset, gliding };
      hold = current;
      try {
        captor.setPointerCapture(pointerId);
      } catch {
        // the pointer is already gone; the window listeners still see its moves
      }
      root.classList.add(DRAG_CLASS);
      spine.classList.add(HELD_CLASS);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerEnd);
      window.addEventListener('pointercancel', onPointerEnd);
      window.addEventListener('blur', release);
      window.addEventListener('contextmenu', onContextMenu);
      document.addEventListener('visibilitychange', onVisibilityChange);
      return current;
    };

    const endPress = (): void => {
      if (!press) return;
      window.clearTimeout(press.timer);
      press = null;
      window.removeEventListener('pointermove', onPressMove);
      window.removeEventListener('pointerup', onPressEnd);
      window.removeEventListener('pointercancel', onPressEnd);
    };
    function onPressMove(event: PointerEvent): void {
      if (!press || event.pointerId !== press.id) return;
      press.lastY = event.clientY;
      // moved before the hold: a swipe — the browser scrolls the page (and cancels the pointer)
      if (!stillPress(event.clientX - press.x, event.clientY - press.y)) endPress();
    }
    function onPressEnd(event: PointerEvent): void {
      if (press && event.pointerId === press.id) endPress();
    }
    /**
     * A finger went down on the head of a touch screen: it takes the head only if it holds still —
     * and only once the page holds still under it. A finger that catches a fling stops it, and then
     * takes the head as usual; but an in-app WebView may let the fling run on under a resting
     * finger, and taking the head then would throw the page back to where the head was when the
     * hold began (tap-guard.ts pageMoving: a scroll frame within the last 150 ms).
     */
    const startPress = (event: PointerEvent): void => {
      const id = event.pointerId;
      const timer = window.setTimeout(() => {
        if (!press || press.id !== id) return;
        const y = press.lastY;
        endPress();
        if (pageMoving()) return;
        startHold(id, true, y, false, grabOffset(track, scrollProgress(pageScroll.read(), max), y), grip);
        // a short buzz where the device allows it: the head is in hand
        try {
          navigator.vibrate?.(8);
        } catch {
          // no vibration (desktop, in-app browsers that block it)
        }
      }, TOUCH_HOLD_MS);
      press = { id, x: event.clientX, y: event.clientY, lastY: event.clientY, timer };
      window.addEventListener('pointermove', onPressMove);
      window.addEventListener('pointerup', onPressEnd);
      window.addEventListener('pointercancel', onPressEnd);
    };
    // Once a finger holds the head, its moves are the drag's, not the page's own scroll (the head
    // lets the browser pan — touch-action: pan-y — so a plain swipe on it still scrolls the page).
    // The first move after the hold is still cancelable: the finger held still within the slop.
    // WebKit (iOS, iPadOS) decides on the first touchmove whether the page may scroll for the whole
    // touch: a jitter of the finger holding the head, let through, would hand the later drag to
    // the page's own scroll (one jump, then the page pans). So there the moves within the slop of a
    // finger still holding are kept as well; a swipe leaves the slop at once and scrolls the page.
    const holdsWithin = (event: TouchEvent): boolean => {
      const touch = event.touches[0];
      return Boolean(press && touch && stillPress(touch.clientX - press.x, touch.clientY - press.y));
    };
    const onTouchMove = (event: TouchEvent): void => {
      if (!event.cancelable) return;
      if (hold?.touch || (webkitTouch && holdsWithin(event))) event.preventDefault();
    };

    const onPointerDown = (event: PointerEvent): void => {
      // Ctrl + click is the context click of macOS: its menu would take the button's release.
      if (!event.isPrimary || event.button !== 0 || event.ctrlKey) return;
      const target = event.target;
      const onHead = target instanceof Node && grip.contains(target);
      if ((!onHead && target !== rail) || track.length <= 0 || max < 1) return;
      stopGlide();
      release();
      endPress();
      if (event.pointerType === 'touch' && touchHits.matches) {
        // A finger on a touch screen: only the head, and only once held still (startPress).
        if (onHead) startPress(event);
        return;
      }
      // No text selection, no focus move, no compatibility mouse events.
      event.preventDefault();
      const offset = onHead ? grabOffset(track, scrollProgress(pageScroll.read(), max), event.clientY) : 0;
      const current = startHold(
        event.pointerId,
        event.pointerType === 'touch',
        event.clientY,
        !onHead,
        offset,
        onHead ? grip : rail,
      );
      if (onHead) {
        // Grabbed: the page holds still under the pointer (stops a wheel glide of Lenis).
        scheduleWrite(event.clientY, offset);
        return;
      }
      // A press on the track: the head glides to the pointer, then follows it while held.
      glideTo(event.clientY, current);
    };
    const onLostCapture = (event: PointerEvent): void => onPointerEnd(event);

    // The page grows / shrinks at runtime (lead form success, <details>, chapters rendered for the
    // first time) and the spine follows the viewport: both are re-measured after layout.
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (resizeObserver) {
      resizeObserver.observe(document.body);
      resizeObserver.observe(spine);
    } else {
      measure();
      window.addEventListener('resize', measure);
    }
    spine.addEventListener('pointerdown', onPointerDown);
    grip.addEventListener('touchmove', onTouchMove, { passive: false });
    spine.addEventListener('lostpointercapture', onLostCapture);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', onScroll);
      spine.removeEventListener('pointerdown', onPointerDown);
      grip.removeEventListener('touchmove', onTouchMove);
      spine.removeEventListener('lostpointercapture', onLostCapture);
      release();
      endPress();
      stopGlide();
      window.cancelAnimationFrame(drawFrame);
      window.cancelAnimationFrame(writeFrame);
      spine.classList.remove(FLAT_CLASS);
    };
  }, []);

  return (
    <div className="spine" aria-hidden="true" ref={spineRef}>
      <div className="spine__track">
        <Wave />
      </div>
      <div className="spine__fill" ref={fillRef}>
        <Wave />
      </div>
      <span className="spine__rail" ref={railRef} />
      <span className="spine__head" ref={headRef}>
        <i className="spine__tongue" />
        <span className="spine__grip" ref={gripRef} />
      </span>
    </div>
  );
}
