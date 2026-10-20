import { INTRO_CLASS } from "./env";

/**
 * Infinite CSS loops (the cover rain and hint arrow, the news ticker, the offers tape, the tongue
 * flicks of the cover and the close-up, the red band's marquee in lite motion) keep the main
 * thread or the compositor busy even while nobody can see them. This pauses them off screen:
 * `.is-off` (noir.css) sets animation-play-state: paused on the element and its descendants, so
 * a loop resumes exactly where it stopped when it comes back.
 *
 * Not while the cover intro runs (html.is-intro): the cover's tongue layer holds the tongue's
 * intro animation, and HeroScene ends the intro only once every intro animation has finished —
 * a paused one never does (a reload restored mid-page, a fast swipe off the cover). Off-screen
 * loops are paused as soon as the intro is over.
 *
 * The fixed scroll snake (slither / flick) is always on screen — on touch screens it rests between
 * scrolls (ScrollSpine); with full motion the red band is a GSAP timeline that pauses off screen
 * by itself.
 */

/** Elements whose infinite loops (own or descendants') pause while off screen. */
const LOOPS = ".splash__rain, .splash__hint-arrow, .ticker, .tape, .snake-tongue, .closeup__tongue, .motion-lite .band__track";

export const OFF_CLASS = "is-off";

/** Starts watching the page's loops; returns the cleanup. No-op without IntersectionObserver. */
export function pauseLoopsOffscreen(): () => void {
  if (typeof IntersectionObserver === "undefined") return () => undefined;
  const targets = document.querySelectorAll(LOOPS);
  if (targets.length === 0) return () => undefined;
  const html = document.documentElement;
  const offscreen = new Set<Element>();
  const apply = (target: Element): void => {
    target.classList.toggle(OFF_CLASS, offscreen.has(target) && !html.classList.contains(INTRO_CLASS));
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) offscreen.delete(entry.target);
        else offscreen.add(entry.target);
        apply(entry.target);
      }
    },
    { rootMargin: "200px 0px" },
  );
  targets.forEach((target) => observer.observe(target));
  // The intro's end (HeroScene removes the class): pause what went off screen meanwhile.
  const introEnd =
    html.classList.contains(INTRO_CLASS) && typeof MutationObserver !== "undefined"
      ? new MutationObserver((_records, watcher) => {
          if (html.classList.contains(INTRO_CLASS)) return;
          watcher.disconnect();
          targets.forEach(apply);
        })
      : null;
  introEnd?.observe(html, { attributes: true, attributeFilter: ["class"] });
  return () => {
    observer.disconnect();
    introEnd?.disconnect();
    targets.forEach((target) => target.classList.remove(OFF_CLASS));
  };
}
