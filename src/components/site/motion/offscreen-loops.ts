/**
 * Infinite CSS loops (the cover rain and hint arrow, the news ticker, the offers tape) keep
 * the main thread busy re-rasterising even while nobody can see them. This pauses them off
 * screen: `.is-off` (noir.css) sets animation-play-state: paused on the element and its
 * descendants, so a loop resumes exactly where it stopped when it comes back.
 *
 * The fixed desktop spine (slither / flick) is always on screen; the red band and the
 * tongue loops are GSAP timelines that already pause off screen.
 */

/** Elements whose infinite loops (own or descendants') pause while off screen. */
const LOOPS = ".splash__rain, .splash__hint-arrow, .ticker, .tape";

export const OFF_CLASS = "is-off";

/** Starts watching the page's loops; returns the cleanup. No-op without IntersectionObserver. */
export function pauseLoopsOffscreen(): () => void {
  if (typeof IntersectionObserver === "undefined") return () => undefined;
  const targets = document.querySelectorAll(LOOPS);
  if (targets.length === 0) return () => undefined;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) entry.target.classList.toggle(OFF_CLASS, !entry.isIntersecting);
    },
    { rootMargin: "200px 0px" },
  );
  targets.forEach((target) => observer.observe(target));
  return () => {
    observer.disconnect();
    targets.forEach((target) => target.classList.remove(OFF_CLASS));
  };
}
