"use client";

import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { withRevealsOff } from "./effects";
import { motionEnabled, PENDING_CLASS, SCENE_LATE_ATTR } from "./env";
import { gsap } from "./gsap";
import { markSceneReady, scheduleScene } from "./scheduler";

/** useLayoutEffect on the client (runs before paint), useEffect during SSR (no warning). */
export const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type SceneSetup<E extends HTMLElement> = (root: E, ctx: gsap.Context) => void | (() => void);

/**
 * Runs `setup` inside `ctx` and reports whether it threw. The error is caught INSIDE the function
 * given to ctx.add(): Context.add() swaps GSAP's global "current context" in and out without a
 * try/finally, so an exception escaping it would leave the (soon reverted) context current and
 * every later tween on the page would be recorded into it.
 */
export function addSafely(ctx: gsap.Context, setup: () => void | (() => void)): { ok: true } | { ok: false; error: unknown } {
  const outcome: { failed: boolean; error: unknown } = { failed: false, error: undefined };
  ctx.add(() => {
    try {
      return setup();
    } catch (error: unknown) {
      outcome.failed = true;
      outcome.error = error;
      return undefined;
    }
  });
  return outcome.failed ? { ok: false, error: outcome.error } : { ok: true };
}

/**
 * Runs a scroll scene for the element in `ref`, scoped with gsap.context():
 *  - only when motion is enabled (html.motion and no reduced-motion preference);
 *  - when its turn comes (scheduler.ts): at once for a scene on screen, otherwise when it
 *    approaches the viewport — one scene per task, after the fonts its titles use;
 *  - everything the setup creates (tweens, ScrollTriggers, SplitTexts, returned cleanups)
 *    is reverted on unmount — the DOM goes back to the server-rendered state;
 *  - if the setup throws, the context is reverted at once, so no content stays hidden;
 *  - the root's data-scene-pending (CSS start states) is removed once the setup ran, failed
 *    or the scene unmounted. Triggers created after `load` measure themselves: no global
 *    ScrollTrigger.refresh() per scene.
 */
export function useScene<E extends HTMLElement>(ref: RefObject<E | null>, setup: SceneSetup<E>): void {
  // The latest setup without re-running the scene on every render.
  const setupRef = useRef(setup);
  useIsomorphicLayoutEffect(() => {
    setupRef.current = setup;
  });

  useIsomorphicLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (!motionEnabled()) {
      markSceneReady(root);
      return;
    }
    const ctx = gsap.context(() => undefined, root);
    const cancel = scheduleScene(root, () => {
      if (ctx.isReverted) return;
      // A late scene — it came near the screen before its setup (SCENE_LATE_ATTR), or the boot
      // failsafe dropped the CSS start states (motion-pending is gone: it is never removed
      // otherwise) — keeps what may already have been seen as rendered (effects.ts unseen()).
      const late = root.hasAttribute(SCENE_LATE_ATTR) || !document.documentElement.classList.contains(PENDING_CLASS);
      const result = withRevealsOff(late, () => addSafely(ctx, () => setupRef.current(root, ctx)));
      if (!result.ok) {
        ctx.revert();
        console.error(result.error);
      }
      markSceneReady(root);
    });

    return () => {
      cancel();
      ctx.revert();
      markSceneReady(root);
    };
  }, [ref]);
}
