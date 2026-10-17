"use client";

import type Lenis from "lenis";
import { useEffect } from "react";
import { SECTION_ANCHORS } from "@/lib/content/anchors";
import { LEAD_INTENT_EVENT, parseLeadIntent } from "@/lib/lead-intent";
import { fragmentId } from "../locale-switch";
import { learnChapterSizes } from "./chapter-sizes";
import { layoutTop } from "./dom-utils";
import { motionEnabled, scheduleRefresh } from "./env";
import { NAVIGATE_EVENT } from "./events";
import { gsap, loadedScrollTrigger, loadScrollTrigger } from "./gsap";
import { setLenis } from "./lenis-store";
import { pauseLoopsOffscreen } from "./offscreen-loops";

const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

/**
 * The header offset comes from CSS: html { scroll-padding-top: var(--hdr-h) } (+ scroll-margin
 * of the target), which both the browser and Lenis ≥ 1.3 subtract. Like the concept, the
 * target ends up 2 px under the header's inked bottom rule.
 */
const UNDER_HEADER_PX = 2;

/** Things the visitor does that end the deep-link alignment (they are scrolling on their own). */
const USER_SCROLL_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

/** Duration of an anchor scroll (s), with Lenis and without. */
const ANCHOR_DURATION = 1.5;

/**
 * Lenis only smooths wheel scrolling (smoothWheel; touch is never smoothed), so it runs for
 * mouse / trackpad visitors only. Touch screens scroll natively: no non-passive wheel / touch
 * listeners, no per-frame Lenis work, no scroll-start delay while the page boots.
 */
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

/** Document y the page scrolls to for `el`: its layout top minus the header (scroll-padding) and its scroll-margin. */
function anchorScrollTop(el: HTMLElement): number {
  const padding = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const margin = Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  return Math.max(0, layoutTop(el) - padding - margin);
}

function maxScroll(): number {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

/**
 * Anchor scroll without Lenis (touch screens): the same curve as Lenis' scrollTo (1.5 s
 * easeOutQuart) drawn with window.scrollTo, stopped as soon as the visitor scrolls, taps or
 * presses a key. Returns the cancel function.
 */
function tweenWindowScroll(top: number, onDone: () => void): () => void {
  const from = window.scrollY;
  const to = Math.min(Math.max(0, top), maxScroll());
  let frame = 0;
  const stop = (): void => {
    window.cancelAnimationFrame(frame);
    frame = 0;
    for (const type of USER_SCROLL_EVENTS) window.removeEventListener(type, stop);
  };
  if (Math.abs(to - from) < 1) {
    onDone();
    return stop;
  }
  let start: number | null = null;
  const step = (now: number): void => {
    start ??= now;
    const t = Math.min(1, (now - start) / (ANCHOR_DURATION * 1000));
    window.scrollTo({ top: from + (to - from) * easeOutQuart(t), behavior: "instant" });
    if (t < 1) {
      frame = window.requestAnimationFrame(step);
    } else {
      stop();
      onDone();
    }
  };
  frame = window.requestAnimationFrame(step);
  for (const type of USER_SCROLL_EVENTS) window.addEventListener(type, stop, { passive: true });
  return stop;
}

/**
 * Smooth scrolling + in-page navigation for the public pages (renders nothing).
 *
 * - Lenis drives the scroll (gsap.ticker → lenis.raf, lenis 'scroll' → ScrollTrigger.update;
 *   both are imported after mount, see below),
 *   only when motion is enabled and the pointer is a mouse / trackpad; touch screens and
 *   prefers-reduced-motion scroll natively (anchor jumps on touch are tweened with the same
 *   curve, tweenWindowScroll).
 * - Same-page anchor links scroll with the header offset, move focus to the target and
 *   update the hash. Links carrying data-lead-type / data-lead-subject (CTA → form) also
 *   dispatch a LeadIntent the form listens to (topic preselect + subject prefill).
 * - ScrollTrigger positions follow the page height: it refreshes on load / resize only, but
 *   the page also grows and shrinks at runtime (the lead form swapped for its success
 *   message, topic fields, <details> opening) — a ResizeObserver on <body> schedules a refresh.
 */
export function SmoothScroll(): null {
  useEffect(() => {
    const motion = motionEnabled();
    let lenis: Lenis | null = null;
    let disposed = false;
    let cancelLenisStart = (): void => undefined;
    const tick = (time: number): void => lenis?.raf(time * 1000);

    // Lenis is not part of the page's first JS: imported once the page is up (first idle
    // moment), mouse / trackpad only. Until then the wheel scrolls natively and anchors use
    // the window tween — the same curve.
    if (motion && window.matchMedia(FINE_POINTER_QUERY).matches) {
      const startLenis = (): void => {
        void import("lenis").then(
          ({ default: LenisClass }) => {
            if (disposed) return;
            const instance = new LenisClass({ lerp: 0.1, smoothWheel: true });
            lenis = instance;
            gsap.ticker.add(tick);
            gsap.ticker.lagSmoothing(0);
            setLenis(instance);
            // ScrollTrigger (loaded for the scenes) follows Lenis' scroll.
            void loadScrollTrigger().then(
              (plugin) => {
                if (!disposed && lenis === instance) instance.on("scroll", plugin.update);
              },
              () => undefined,
            );
          },
          (error: unknown) => console.error(error),
        );
      };
      if (typeof window.requestIdleCallback === "function") {
        const idle = window.requestIdleCallback(startLenis, { timeout: 1500 });
        cancelLenisStart = () => window.cancelIdleCallback(idle);
      } else {
        const timer = window.setTimeout(startLenis, 0);
        cancelLenisStart = () => window.clearTimeout(timer);
      }
    }
    // The cover rain, the ticker and the tape stop while off screen.
    const resumeLoops = pauseLoopsOffscreen();
    // Chapters skipped by content-visibility learn their real height once, in idle time.
    const stopLearning = learnChapterSizes();

    // Trigger start/end positions are measured at refresh; when the document height changes
    // (and not the viewport — ScrollTrigger handles resizes itself) they must be re-measured,
    // or reveals below the change fire too early / too late / never (past the new max scroll).
    let lastHeight = document.body.offsetHeight;
    const heightObserver =
      motion && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            const height = document.body.offsetHeight;
            if (height === lastHeight) return;
            lastHeight = height;
            scheduleRefresh();
          })
        : null;
    heightObserver?.observe(document.body);

    let cancelTween = (): void => undefined;
    /**
     * After a smooth anchor scroll: chapters passed on the way may have been rendered for the
     * first time (content-visibility) and moved the target — land on it exactly.
     */
    const settleOn = (el: HTMLElement): void => {
      const top = Math.min(anchorScrollTop(el) + UNDER_HEADER_PX, maxScroll());
      if (Math.abs(window.scrollY - top) <= 2) return;
      if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
      else window.scrollTo({ top, behavior: "instant" });
    };
    const goTo = (el: HTMLElement): void => {
      const isTop = el.id === SECTION_ANCHORS.hero || el.id === "main";
      cancelTween();
      if (lenis) {
        lenis.scrollTo(isTop ? 0 : el, {
          offset: isTop ? 0 : UNDER_HEADER_PX,
          duration: ANCHOR_DURATION,
          easing: easeOutQuart,
          force: true,
          onComplete: () => {
            if (!isTop) settleOn(el);
          },
        });
      } else if (motion) {
        cancelTween = tweenWindowScroll(isTop ? 0 : anchorScrollTop(el) + UNDER_HEADER_PX, () => {
          if (!isTop) settleOn(el);
        });
      } else if (isTop) {
        window.scrollTo({ top: 0, behavior: "auto" });
      } else {
        el.scrollIntoView({ behavior: "auto", block: "start" });
      }
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    };

    const onClick = (event: MouseEvent): void => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href*='#']");
      if (!link || (link.target && link.target !== "_self")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) return;
      const id = decodeURIComponent(url.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      event.preventDefault();

      if (link.dataset.leadType) {
        const intent = parseLeadIntent({ type: link.dataset.leadType, subject: link.dataset.leadSubject ?? "" });
        if (intent) window.dispatchEvent(new CustomEvent(LEAD_INTENT_EVENT, { detail: intent }));
      }
      window.dispatchEvent(new Event(NAVIGATE_EVENT));
      goTo(target);
      window.history.replaceState(window.history.state, "", `#${id}`);
    };

    // Deep links (/catalog/…#product-…, /#lead-form, a language switch to "/en#reviews"): the
    // browser jumps to the target by its box INCLUDING transforms, and the reveal scenes lower
    // items (covers, coupons) for their drop-in — so the jump could land up to ~90 px too far,
    // under the header. Re-align to the untransformed position until the visitor scrolls.
    let userScrolled = false;
    const onUserScroll = (): void => {
      userScrolled = true;
    };
    const alignToHash = (): void => {
      if (userScrolled) return;
      const id = fragmentId(window.location.hash);
      const target = id && id !== SECTION_ANCHORS.hero && id !== "main" ? document.getElementById(id) : null;
      if (!target) return;
      const top = anchorScrollTop(target);
      if (Math.abs(window.scrollY - top) < 2) return;
      if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
      else window.scrollTo({ top, behavior: "instant" });
    };
    const frame = window.requestAnimationFrame(alignToHash);
    void document.fonts.ready.then(alignToHash);

    const onLoad = (): void => {
      loadedScrollTrigger()?.refresh();
      alignToHash();
    };

    for (const type of USER_SCROLL_EVENTS) window.addEventListener(type, onUserScroll, { passive: true, once: true });
    document.addEventListener("click", onClick);
    window.addEventListener("load", onLoad);
    return () => {
      window.cancelAnimationFrame(frame);
      cancelTween();
      userScrolled = true; // a pending fonts.ready callback must not scroll an unmounted page
      for (const type of USER_SCROLL_EVENTS) window.removeEventListener(type, onUserScroll);
      document.removeEventListener("click", onClick);
      window.removeEventListener("load", onLoad);
      heightObserver?.disconnect();
      resumeLoops();
      stopLearning();
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
