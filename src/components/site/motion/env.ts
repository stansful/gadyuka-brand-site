import { loadedScrollTrigger } from "./gsap";

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

/** Server-rendered on every scene root (SceneRoot); removed once the scene is set up (scheduler.ts). */
export const SCENE_PENDING_ATTR = "data-scene-pending";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_QUERY).matches;
}

export function motionEnabled(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains(MOTION_CLASS) && !prefersReducedMotion();
}

/** Mouse / trackpad (tilt, cursor bubble); touch screens get the "lit when centred" variant. */
export function hasFinePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

let refreshTimer: number | undefined;

/** Coalesces ScrollTrigger.refresh() calls (page height changes); nothing to do before it loaded. */
export function scheduleRefresh(): void {
  if (typeof window === "undefined") return;
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => loadedScrollTrigger()?.refresh(), 120);
}
