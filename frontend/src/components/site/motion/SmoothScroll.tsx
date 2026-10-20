'use client';

import { useEffect } from 'react';

import { SECTION_ANCHORS } from '@/lib/content/anchors';
import { LEAD_INTENT_EVENT, parseLeadIntent } from '@/lib/lead-intent';

import type Lenis from 'lenis';

import { fragmentId } from '../locale-switch';
import { layoutTop } from './dom-utils';
import {
  hasFinePointer,
  isTouchScreen,
  liteMotion,
  motionEnabled,
  onRefreshed,
  scheduleRefresh,
  trackScrollActivity,
} from './env';
import { NAVIGATE_EVENT } from './events';
import { gsap, loadScrollTrigger } from './gsap';
import { setLenis } from './lenis-store';
import { startLiteMotion } from './lite';
import { pauseLoopsOffscreen } from './offscreen-loops';
import { heightChangeNeedsRefresh } from './refresh-gate';
import { clampScroll, pageScroll, tweenScroll, USER_SCROLL_EVENTS } from './scroll-tween';
import { visitorActed } from './tap-guard';

/**
 * The header offset comes from CSS: html { scroll-padding-top: var(--hdr-h) } (+ scroll-margin
 * of the target), which both the browser and Lenis ≥ 1.3 subtract. Like the concept, the
 * target ends up 2 px under the header's inked bottom rule.
 */
const UNDER_HEADER_PX = 2;

/**
 * Lenis only smooths wheel scrolling (smoothWheel; touch is never smoothed), so it runs for
 * mouse / trackpad visitors only. Touch screens scroll natively: no non-passive wheel / touch
 * listeners, no per-frame Lenis work, no scroll-start delay while the page boots.
 */
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

/** The header (scroll-padding of <html>) + the element's scroll-margin: what an anchor scroll leaves above `el`. */
function anchorInset(el: HTMLElement): number {
  const padding = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const margin = Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  return padding + margin;
}

/** Document y the page scrolls to for `el`: its layout top minus the header (scroll-padding) and its scroll-margin. */
function anchorScrollTop(el: HTMLElement): number {
  return Math.max(0, layoutTop(el) - anchorInset(el));
}

/**
 * Smooth scrolling + in-page navigation for the public pages (renders nothing).
 *
 * - Lenis drives the scroll (gsap.ticker → lenis.raf, lenis 'scroll' → ScrollTrigger.update;
 *   both are imported after mount, see below),
 *   only when motion is enabled and the pointer is a mouse / trackpad; touch screens and
 *   prefers-reduced-motion scroll natively.
 * - Same-page anchor links scroll with the header offset (scroll-tween.ts tweenScroll — through
 *   Lenis when it runs, else window.scrollTo), move focus to the target and update the hash.
 *   Links carrying data-lead-type / data-lead-subject (CTA → form) also dispatch a LeadIntent the
 *   form listens to (topic preselect + subject prefill).
 * - ScrollTrigger positions follow the page height: it refreshes on resize only, but the page
 *   also grows and shrinks at runtime (chapters rendered for the first time — content-visibility
 *   estimates —, the lead form swapped for its success message, topic fields, <details>
 *   opening) — a ResizeObserver on <body> schedules a refresh, the safe kind (env.ts: after the
 *   swipe, never during it). A touch screen's viewport-height-only change (an in-app toolbar or
 *   the cover's 100svh following it) is left to ScrollTrigger, which ignores it there.
 * - In-app browsers (motion-lite, in-app.ts): no Lenis, no ScrollTrigger; motion/lite.ts.
 */
export function SmoothScroll(): null {
  useEffect(() => {
    const motion = motionEnabled();
    const lite = motion && liteMotion();
    let lenis: Lenis | null = null;
    let disposed = false;
    let cancelLenisStart = (): void => undefined;
    const tick = (time: number): void => lenis?.raf(time * 1000);

    // Lenis is not part of the page's first JS: imported once the page is up (first idle
    // moment), mouse / trackpad only. Until then the wheel scrolls natively and anchors use
    // the window tween — the same curve. Never in lite motion: an in-app browser with a mouse
    // or trackpad (a tablet, ChromeOS) scrolls natively too, and ScrollTrigger stays unloaded.
    if (motion && !lite && window.matchMedia(FINE_POINTER_QUERY).matches) {
      const startLenis = (): void => {
        void import('lenis').then(
          ({ default: LenisClass }) => {
            if (disposed) return;
            const instance = new LenisClass({ lerp: 0.1, smoothWheel: true });
            lenis = instance;
            gsap.ticker.add(tick);
            gsap.ticker.lagSmoothing(0);
            setLenis(instance);
            // ScrollTrigger (loaded for the scenes) follows Lenis' scroll.
            void loadScrollTrigger().then(
              plugin => {
                if (!disposed && lenis === instance) instance.on('scroll', plugin.update);
              },
              () => undefined,
            );
          },
          (error: unknown) => console.error(error),
        );
      };
      if (typeof window.requestIdleCallback === 'function') {
        const idle = window.requestIdleCallback(startLenis, { timeout: 1500 });
        cancelLenisStart = () => window.cancelIdleCallback(idle);
      } else {
        const timer = window.setTimeout(startLenis, 0);
        cancelLenisStart = () => window.clearTimeout(timer);
      }
    }
    // The cover rain, the ticker, the tape and the tongue flicks stop while off screen.
    const resumeLoops = pauseLoopsOffscreen();
    const stopLite = lite ? startLiteMotion() : (): void => undefined;

    // Set by a touch screen's resize that kept the width, for the rendering update it happens in:
    // the body's own resize is observed later in that update (the second frame callback clears it).
    let heightOnlyResize = false;
    let viewportWidth = window.innerWidth;
    /** The viewport height of the last resize refresh requested on a touch screen. */
    let measuredViewportHeight = window.innerHeight;
    let clearResizeFrame = 0;
    const onResize = (): void => {
      const widthChanged = window.innerWidth !== viewportWidth;
      viewportWidth = window.innerWidth;
      // Touch screens: ScrollTrigger's own resize refresh is off (gsap.ts) — a width change
      // (rotation, split screen) or a big height change (a WebView's keyboard: what GSAP's
      // ignoreMobileResize lets through, > 25 %) is re-measured here, through the still-page gate.
      if (
        isTouchScreen() &&
        (widthChanged || Math.abs(window.innerHeight - measuredViewportHeight) > window.innerHeight * 0.25)
      ) {
        measuredViewportHeight = window.innerHeight;
        scheduleRefresh();
      }
      if (widthChanged || hasFinePointer()) return;
      heightOnlyResize = true;
      window.cancelAnimationFrame(clearResizeFrame);
      clearResizeFrame = window.requestAnimationFrame(() => {
        clearResizeFrame = window.requestAnimationFrame(() => {
          heightOnlyResize = false;
        });
      });
    };
    // Trigger start/end positions are measured at refresh; when the document height changes
    // (and not the viewport — ScrollTrigger handles resizes itself) they must be re-measured,
    // or reveals below the change fire too early / too late / never (past the new max scroll).
    let lastHeight = document.body.offsetHeight;
    /** The height the last requested refresh will measure (refresh-gate.ts: touch screens skip small changes). */
    let refreshedHeight = lastHeight;
    // Every refresh (whoever asked for it) measured the page as it is: the height threshold counts
    // from there. A full one dispatches ScrollTrigger's "refresh"; a touch screen's trigger-by-
    // trigger re-measure (env.ts refreshEach) is announced by onRefreshed.
    const rebaseHeight = (): void => {
      refreshedHeight = document.body.offsetHeight;
    };
    let stopRebase = (): void => undefined;
    if (motion && !lite) {
      trackScrollActivity();
      const stopTouchRebase = onRefreshed(rebaseHeight);
      stopRebase = stopTouchRebase;
      void loadScrollTrigger().then(
        plugin => {
          if (disposed) return;
          plugin.addEventListener('refresh', rebaseHeight);
          stopRebase = () => {
            stopTouchRebase();
            plugin.removeEventListener('refresh', rebaseHeight);
          };
        },
        () => undefined,
      );
    }
    const heightObserver =
      motion && !lite && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            const height = document.body.offsetHeight;
            if (height === lastHeight) return;
            lastHeight = height;
            // Touch screens: the body follows a viewport-height-only resize (an in-app toolbar
            // collapsing, the cover's 100svh with it) — ScrollTrigger ignores those resizes there
            // (ignoreMobileResize); a refresh for them would only redo the same positions.
            if (heightOnlyResize) return;
            // Touch screens: a few px of late font / image layout are not worth a refresh (each
            // one is a chance to undo a swipe); bigger changes (the lead form's success) still are.
            if (!heightChangeNeedsRefresh(isTouchScreen(), height, refreshedHeight)) return;
            refreshedHeight = height;
            scheduleRefresh();
          })
        : null;
    heightObserver?.observe(document.body);
    if (heightObserver) window.addEventListener('resize', onResize);

    let cancelTween = (): void => undefined;
    /** The page's scroll position, through Lenis while it runs (the instance in `lenis`, published by setLenis). */
    const port = pageScroll;
    /** Safety net after an anchor scroll (the tween already follows the target): land on it exactly. */
    const settleOn = (el: HTMLElement): void => {
      const top = clampScroll(anchorScrollTop(el) + UNDER_HEADER_PX);
      if (Math.abs(port.read() - top) <= 2) return;
      port.write(top);
    };
    const goTo = (el: HTMLElement): void => {
      const isTop = el.id === SECTION_ANCHORS.hero || el.id === 'main';
      cancelTween();
      if (motion) {
        if (isTop) {
          cancelTween = tweenScroll(
            port,
            () => 0,
            () => undefined,
          );
        } else {
          // The header inset does not change during the tween: read once, the layout top per frame.
          const inset = anchorInset(el);
          cancelTween = tweenScroll(
            port,
            () => Math.max(0, layoutTop(el) - inset) + UNDER_HEADER_PX,
            () => settleOn(el),
          );
        }
      } else if (isTop) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      } else {
        el.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    };

    const onClick = (event: MouseEvent): void => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href*='#']");
      if (!link || (link.target && link.target !== '_self')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) return;
      const id = decodeURIComponent(url.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      event.preventDefault();

      if (link.dataset.leadType) {
        const intent = parseLeadIntent({ type: link.dataset.leadType, subject: link.dataset.leadSubject ?? '' });
        if (intent) window.dispatchEvent(new CustomEvent(LEAD_INTENT_EVENT, { detail: intent }));
      }
      window.dispatchEvent(new Event(NAVIGATE_EVENT));
      goTo(target);
      window.history.replaceState(window.history.state, '', `#${id}`);
    };

    // Deep links (/catalog/…#product-…, /#lead-form, a language switch to "/en#reviews"): the
    // browser jumps to the target by its box INCLUDING transforms, and the reveal scenes lower
    // items (covers, coupons) for their drop-in — so the jump could land up to ~90 px too far,
    // under the header. Re-align to the untransformed position until the visitor scrolls — or has
    // already acted before hydration (MOTION_BOOT notes it from the first script: a cold in-app
    // browser hydrates seconds after the visitor's first swipes, and a re-alignment then would
    // throw the page back to the fragment mid-fling).
    let userScrolled = visitorActed();
    const onUserScroll = (): void => {
      userScrolled = true;
    };
    const alignToHash = (): void => {
      if (userScrolled) return;
      const id = fragmentId(window.location.hash);
      const target = id && id !== SECTION_ANCHORS.hero && id !== 'main' ? document.getElementById(id) : null;
      if (!target) return;
      const top = anchorScrollTop(target);
      if (Math.abs(window.scrollY - top) < 2) return;
      if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
      else window.scrollTo({ top, behavior: 'instant' });
    };
    const frame = window.requestAnimationFrame(alignToHash);
    void document.fonts.ready.then(alignToHash);

    // Positions measured before the late images / fonts: re-measured once the page has loaded,
    // the safe way (after the visitor's swipe, if one is going on — env.ts scheduleRefresh).
    const onLoad = (): void => {
      scheduleRefresh();
      alignToHash();
    };

    for (const type of USER_SCROLL_EVENTS) window.addEventListener(type, onUserScroll, { passive: true, once: true });
    document.addEventListener('click', onClick);
    window.addEventListener('load', onLoad);
    return () => {
      window.cancelAnimationFrame(frame);
      cancelTween();
      userScrolled = true; // a pending fonts.ready callback must not scroll an unmounted page
      for (const type of USER_SCROLL_EVENTS) window.removeEventListener(type, onUserScroll);
      document.removeEventListener('click', onClick);
      window.removeEventListener('load', onLoad);
      heightObserver?.disconnect();
      stopRebase();
      window.removeEventListener('resize', onResize);
      window.cancelAnimationFrame(clearResizeFrame);
      resumeLoops();
      stopLite();
      disposed = true;
      cancelLenisStart();
      if (lenis) {
        gsap.ticker.remove(tick);
        gsap.ticker.lagSmoothing(500, 33);
        lenis.destroy();
        setLenis(null);
      }
    };
  }, []);

  return null;
}
