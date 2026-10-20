'use client';

import { type ReactElement, type ReactNode, useRef } from 'react';

import { inContext } from '../motion/effects';
import { hasFinePointer, INTRO_CLASS, liteMotion, motionEnabled, scheduleRefresh } from '../motion/env';
import { gsap, loadScrollTrigger } from '../motion/gsap';
import { addSafely, useIsomorphicLayoutEffect } from '../motion/useScene';

/** Every keyframes rule of the cover intro is named "intro-…" (noir.css, «COVER INTRO»). */
const INTRO_PREFIX = 'intro-';

/** Mounted hero scenes (React StrictMode mounts, unmounts and remounts effects in dev). */
let mountedScenes = 0;

function q<T extends Element>(root: ParentNode, selector: string): T | null {
  return root.querySelector<T>(selector);
}

/** The cover intro's CSS animations still running or waiting for their delay. */
function introAnimations(): CSSAnimation[] {
  return document
    .getAnimations()
    .filter(
      (animation): animation is CSSAnimation =>
        animation instanceof CSSAnimation && animation.animationName.startsWith(INTRO_PREFIX),
    );
}

/** Resolves when every animation has finished (or was cancelled). */
function settled(animations: ReadonlyArray<Animation>): Promise<void> {
  return Promise.allSettled(animations.map(animation => animation.finished)).then(() => undefined);
}

/**
 * Hero «обложка». The intro itself — the frame inked, the snake dripping in, the band and the
 * wordmark stamped, the slogan and captions typed, SFX popped, the hint — is CSS that starts
 * with the first paint (html.is-intro, see noir.css «COVER INTRO»), so the cover never waits
 * for this bundle; so is the tongue's flick after it (noir.css «tongue flick», a compositor
 * animation of its own layer). This scene adds what comes after: the cover turns away like a page
 * on scroll, the SFX drifts up, a «О нас →» bubble follows the mouse over the cover link (not
 * over the collection plate laid over it: another element, so the cover gets pointerleave); and
 * it ends the intro (removes is-intro) once its animations have finished. Without motion the
 * server-rendered cover stays as is. In-app browsers (lite motion) load no ScrollTrigger: the
 * page turn and the SFX drift are CSS scroll-driven animations there (noir.css «LITE MOTION»).
 */
export function HeroScene({
  children,
  className,
  id,
  labelledBy,
}: {
  children: ReactNode;
  className: string;
  id: string;
  labelledBy: string;
}): ReactElement {
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
    const lite = liteMotion();
    const ctx = gsap.context(() => undefined, hero);

    const splash = q<HTMLElement>(hero, '.splash');
    // The cover link and the collection plate laid over it turn away together.
    const cover = q<HTMLElement>(hero, '.splash-wrap') ?? splash;
    const sfx = q<HTMLElement>(hero, '.sfx--hiss');
    const leave = { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.4 };

    // addSafely: a throw inside the setup must not corrupt GSAP's current context.
    const result = addSafely(ctx, () => {
      if (!splash) return undefined;

      // cursor bubble
      const cursor = q<HTMLElement>(hero, '.splash__cursor');
      if (!cursor || !hasFinePointer()) return undefined;
      const xTo = gsap.quickTo(cursor, 'x', { duration: 0.45, ease: 'power3.out' });
      const yTo = gsap.quickTo(cursor, 'y', { duration: 0.45, ease: 'power3.out' });
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
      splash.addEventListener('pointerenter', enter);
      splash.addEventListener('pointerleave', exit);
      splash.addEventListener('pointermove', move);
      return () => {
        splash.removeEventListener('pointerenter', enter);
        splash.removeEventListener('pointerleave', exit);
        splash.removeEventListener('pointermove', move);
      };
    });
    if (!result.ok) {
      ctx.revert();
      console.error(result.error);
    }

    // Scroll-linked parts wait for ScrollTrigger (loaded after mount, gsap.ts): the page-turn
    // feel when leaving the cover. Lite motion: CSS (no ScrollTrigger at all).
    const scrolling = lite ? null : loadScrollTrigger();
    void scrolling?.then(
      inContext(ctx, () => {
        if (cover) gsap.to(cover, { scale: 0.93, rotation: -1.2, opacity: 0.35, ease: 'none', scrollTrigger: leave });
      }),
      () => undefined,
    );
    // The SFX drifts up with the scroll. Attached after its own intro animation: GSAP reads the
    // element's current transform once, and must not take an in-between frame for its rest state.
    const attachSfx = (): void => {
      void scrolling?.then(
        inContext(ctx, () => {
          if (sfx) gsap.to(sfx, { yPercent: -120, ease: 'none', scrollTrigger: leave });
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

      const sfxIntro = intro.filter(
        animation => animation.effect instanceof KeyframeEffect && animation.effect.target === sfx,
      );
      void settled(sfxIntro).then(() => {
        if (!disposed) attachSfx();
      });

      // The intro is over once every layer has finished (the last caption may still be typing
      // after the hint has appeared). Like GSAP's caption plates, the typed captions keep
      // pivoting on their left edge.
      void settled(intro).then(() => {
        if (disposed) return;
        if (played)
          hero.querySelectorAll<HTMLElement>('.splash__cap').forEach(cap => (cap.style.transformOrigin = '0% 50%'));
        html.classList.remove(INTRO_CLASS);
      });
      if (!lite) scheduleRefresh();
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
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
