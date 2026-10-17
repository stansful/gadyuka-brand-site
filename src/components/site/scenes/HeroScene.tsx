"use client";

import { type ReactElement, type ReactNode, useRef } from "react";
import { hasFinePointer, INTRO_CLASS, motionEnabled, scheduleRefresh } from "../motion/env";
import { inContext, playWhileVisible, tongueLoop } from "../motion/effects";
import { gsap, loadScrollTrigger } from "../motion/gsap";
import { addSafely, useIsomorphicLayoutEffect } from "../motion/useScene";

/** Pivot of the snake's tongue in the logo's SVG user space. */
const TONGUE_ORIGIN = "586 314";
/** Intro clock (ms): the tongue starts flicking 1.1 s after it has shot out (noir.css intro-tongue). */
const TONGUE_LOOP_AT = 2600;
/** Every keyframes rule of the cover intro is named "intro-…" (noir.css, «COVER INTRO»). */
const INTRO_PREFIX = "intro-";

/** Mounted hero scenes (React StrictMode mounts, unmounts and remounts effects in dev). */
let mountedScenes = 0;

function q<T extends Element>(root: ParentNode, selector: string): T | null {
  return root.querySelector<T>(selector);
}

/** The cover intro's CSS animations still running or waiting for their delay. */
function introAnimations(): CSSAnimation[] {
  return document.getAnimations().filter((animation): animation is CSSAnimation => animation instanceof CSSAnimation && animation.animationName.startsWith(INTRO_PREFIX));
}

/**
 * Time on the intro clock (ms). All intro animations start together at the first paint, so the
 * local time of any of them (delay included) is the time since the intro started.
 */
function introTime(animations: ReadonlyArray<CSSAnimation>): number {
  if (animations.length === 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, ...animations.map((animation) => (typeof animation.currentTime === "number" ? animation.currentTime : 0)));
}

/** Resolves when every animation has finished (or was cancelled). */
function settled(animations: ReadonlyArray<Animation>): Promise<void> {
  return Promise.allSettled(animations.map((animation) => animation.finished)).then(() => undefined);
}

/**
 * Hero «обложка». The intro itself — the frame inked, the snake dripping in, the band and the
 * wordmark stamped, the slogan and captions typed, SFX popped, the hint — is CSS that starts
 * with the first paint (html.is-intro, see noir.css «COVER INTRO»), so the cover never waits
 * for this bundle. This scene adds what comes after: the tongue flicks while the cover is on
 * screen (from 2.6 s on the intro clock), the cover turns away like a page on scroll, the SFX
 * drifts up, a «О нас →» bubble follows the mouse; and it ends the intro (removes is-intro)
 * once its animations have finished. Without motion the server-rendered cover stays as is.
 */
export function HeroScene({ children, className, id, labelledBy }: { children: ReactNode; className: string; id: string; labelledBy: string }): ReactElement {
  const ref = useRef<HTMLElement>(null);

  useIsomorphicLayoutEffect(() => {
    const hero = ref.current;
    const html = document.documentElement;
    if (!hero) return;
    if (!motionEnabled()) {
      html.classList.remove(INTRO_CLASS);
      return;
    }
    mountedScenes += 1;
    let disposed = false;
    let frame = 0;
    let tongueTimer: number | undefined;
    const ctx = gsap.context(() => undefined, hero);

    const splash = q<HTMLElement>(hero, ".splash");
    const tongue = q<SVGGElement>(hero, ".snake__tongue");
    const sfx = q<HTMLElement>(hero, ".sfx--hiss");
    const leave = { trigger: hero, start: "top top", end: "bottom top", scrub: 0.4 };

    // addSafely: a throw inside the setup must not corrupt GSAP's current context.
    const result = addSafely(ctx, () => {
      if (!splash) return undefined;

      // cursor bubble
      const cursor = q<HTMLElement>(hero, ".splash__cursor");
      if (!cursor || !hasFinePointer()) return undefined;
      const xTo = gsap.quickTo(cursor, "x", { duration: 0.45, ease: "power3.out" });
      const yTo = gsap.quickTo(cursor, "y", { duration: 0.45, ease: "power3.out" });
      const enter = inContext(ctx, () => {
        gsap.to(cursor, { opacity: 1, scale: 1, duration: 0.3 });
      });
      const exit = inContext(ctx, () => {
        gsap.to(cursor, { opacity: 0, scale: 0.6, duration: 0.3 });
      });
      const move = (event: PointerEvent): void => {
        const r = splash.getBoundingClientRect();
        xTo(event.clientX - r.left + 26);
        yTo(event.clientY - r.top + 26);
      };
      splash.addEventListener("pointerenter", enter);
      splash.addEventListener("pointerleave", exit);
      splash.addEventListener("pointermove", move);
      return () => {
        splash.removeEventListener("pointerenter", enter);
        splash.removeEventListener("pointerleave", exit);
        splash.removeEventListener("pointermove", move);
      };
    });
    if (!result.ok) {
      ctx.revert();
      console.error(result.error);
    }

    // Scroll-linked parts wait for ScrollTrigger (loaded after mount, gsap.ts): the page-turn
    // feel when leaving the cover and the tongue loop, which plays while the cover is on screen.
    const scrolling = loadScrollTrigger();
    void scrolling.then(
      inContext(ctx, () => {
        if (splash) gsap.to(splash, { scale: 0.93, rotation: -1.2, opacity: 0.35, ease: "none", scrollTrigger: leave });
      }),
      () => undefined,
    );
    const startTongue = (): void => {
      void scrolling.then(
        inContext(ctx, () => {
          if (tongue) playWhileVisible(hero, tongueLoop(tongue, { svgOrigin: TONGUE_ORIGIN }));
        }),
        () => undefined,
      );
    };
    // The SFX drifts up with the scroll. Attached after its own intro animation: GSAP reads the
    // element's current transform once, and must not take an in-between frame for its rest state.
    const attachSfx = (): void => {
      void scrolling.then(
        inContext(ctx, () => {
          if (sfx) gsap.to(sfx, { yPercent: -120, ease: "none", scrollTrigger: leave });
        }),
        () => undefined,
      );
    };

    // Where is the intro? Asked in a frame callback: frames are only produced once the
    // render-blocking stylesheet has applied, so its animations exist by then.
    frame = window.requestAnimationFrame(() => {
      if (disposed) return;
      const played = html.classList.contains(INTRO_CLASS);
      const intro = played ? introAnimations() : [];
      const now = introTime(intro);
      if (now < TONGUE_LOOP_AT) tongueTimer = window.setTimeout(startTongue, TONGUE_LOOP_AT - now);
      else startTongue();

      const sfxIntro = intro.filter((animation) => animation.effect instanceof KeyframeEffect && animation.effect.target === sfx);
      void settled(sfxIntro).then(() => {
        if (!disposed) attachSfx();
      });

      // The intro is over once every layer has finished (the last caption may still be typing
      // after the hint has appeared). Like GSAP's caption plates, the typed captions keep
      // pivoting on their left edge.
      void settled(intro).then(() => {
        if (disposed) return;
        if (played) hero.querySelectorAll<HTMLElement>(".splash__cap").forEach((cap) => (cap.style.transformOrigin = "0% 50%"));
        html.classList.remove(INTRO_CLASS);
      });
      scheduleRefresh();
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(tongueTimer);
      ctx.revert();
      mountedScenes -= 1;
      // Never leave the intro state behind us — unless the scene is immediately remounted.
      window.setTimeout(() => {
        if (mountedScenes === 0) html.classList.remove(INTRO_CLASS);
      }, 0);
    };
  }, []);

  return (
    <section ref={ref} className={className} id={id} aria-labelledby={labelledBy}>
      {children}
    </section>
  );
}
