"use client";

import { type ReactElement, useEffect, useRef } from "react";
import { getLenis } from "../motion/lenis-store";

const WAVE =
  "M12 0 C22 25 22 25 12 50 S2 75 12 100 S22 125 12 150 S2 175 12 200 S22 225 12 250 S2 275 12 300 S22 325 12 350 S2 375 12 400 S22 425 12 450 S2 475 12 500";

function Wave(): ReactElement {
  return (
    <svg className="spine__wave" viewBox="0 0 24 500" preserveAspectRatio="none" focusable="false">
      <path d={WAVE} />
    </svg>
  );
}

/** The snake is drawn from this width up (below it `.spine` is display:none and the bar shows). */
const DESKTOP_QUERY = "(min-width: 1024px)";

/** CSS scroll-driven animations' JS constructor (Chrome 115+, Safari 26+); not in TypeScript's DOM lib yet. */
type ScrollTimelineConstructor = new (options: { source: Element; axis: "block" }) => AnimationTimeline;

function scrollTimelineConstructor(): ScrollTimelineConstructor | null {
  const ctor: unknown = Reflect.get(window, "ScrollTimeline");
  return typeof ctor === "function" ? (ctor as ScrollTimelineConstructor) : null;
}

const headFrames = (height: number): Keyframe[] => [{ transform: "translate3d(0, 0px, 0)" }, { transform: `translate3d(0, ${height.toFixed(1)}px, 0)` }];

/**
 * Reading progress: a slithering snake along the right edge (desktop) / a thin line under
 * the header (< 1024 px). Decorative (aria-hidden); with reduced motion the CSS stops the
 * slither, progress stays.
 *
 * Where the browser has scroll timelines, the progress is three scroll-driven Web Animations
 * (bar scaleX, fill clip-path, head transform; progress = scrollTop / max scroll, exactly the
 * old formula): no script runs while scrolling. Elsewhere one rAF-throttled scroll handler
 * draws it. Neither forces a layout: the scroll position is read in the passive scroll
 * listener, the maximum scroll and the spine height are cached and re-measured by
 * ResizeObservers (their callbacks run after layout), and the rAF callback only writes
 * clip-path / transform.
 */
export function ScrollSpine(): ReactElement {
  const spineRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const ScrollTimeline = scrollTimelineConstructor();
    if (ScrollTimeline) {
      const options: KeyframeAnimationOptions = {
        timeline: new ScrollTimeline({ source: document.documentElement, axis: "block" }),
        duration: "auto",
        easing: "linear",
        fill: "both",
      };
      const animations: Animation[] = [];
      const head = headRef.current?.animate(headFrames(spineRef.current?.clientHeight ?? 0), options);
      if (head) animations.push(head);
      const fill = fillRef.current?.animate([{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)" }], options);
      if (fill) animations.push(fill);
      const bar = barRef.current?.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], options);
      if (bar) animations.push(bar);
      // The head travels the spine's height, which follows the viewport.
      const resizeObserver =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(() => {
              if (head?.effect instanceof KeyframeEffect) head.effect.setKeyframes(headFrames(spineRef.current?.clientHeight ?? 0));
            })
          : null;
      if (spineRef.current) resizeObserver?.observe(spineRef.current);
      return () => {
        resizeObserver?.disconnect();
        animations.forEach((animation) => animation.cancel());
      };
    }

    const root = document.documentElement;
    const desktop = window.matchMedia(DESKTOP_QUERY);
    let frame = 0;
    let scrollY = window.scrollY;
    let max = Math.max(1, root.scrollHeight - window.innerHeight);
    let spineHeight = spineRef.current?.clientHeight ?? 0;

    const render = (): void => {
      frame = 0;
      const p = Math.min(1, Math.max(0, scrollY / max));
      if (desktop.matches) {
        if (spineHeight > 0 && fillRef.current && headRef.current) {
          fillRef.current.style.clipPath = `inset(0 0 ${((1 - p) * 100).toFixed(2)}% 0)`;
          headRef.current.style.transform = `translate3d(0, ${(p * spineHeight).toFixed(1)}px, 0)`;
        }
      } else if (barRef.current) {
        barRef.current.style.transform = `scaleX(${p.toFixed(4)})`;
      }
    };
    const schedule = (): void => {
      if (frame === 0) frame = window.requestAnimationFrame(render);
    };
    const onScroll = (): void => {
      scrollY = getLenis()?.scroll ?? window.scrollY;
      schedule();
    };
    const measure = (): void => {
      max = Math.max(1, root.scrollHeight - window.innerHeight);
      spineHeight = spineRef.current?.clientHeight ?? 0;
      scrollY = getLenis()?.scroll ?? window.scrollY;
      schedule();
    };

    // The page grows / shrinks at runtime (lead form success, <details>, lazy scenes) and the
    // spine follows the viewport: both are re-measured after layout, never inside the rAF.
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    resizeObserver?.observe(document.body);
    if (spineRef.current) resizeObserver?.observe(spineRef.current);

    render();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    desktop.addEventListener("change", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      desktop.removeEventListener("change", measure);
    };
  }, []);

  return (
    <>
      <div className="spine" aria-hidden="true" ref={spineRef}>
        <div className="spine__track">
          <Wave />
        </div>
        <div className="spine__fill" ref={fillRef}>
          <Wave />
        </div>
        <span className="spine__head" ref={headRef}>
          <i className="spine__tongue" />
        </span>
      </div>
      <div className="spine-x" aria-hidden="true">
        <span ref={barRef} />
      </div>
    </>
  );
}
