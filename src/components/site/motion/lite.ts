import { hasFinePointer } from "./env";

/**
 * Lite motion (in-app browsers, in-app.ts): no scroll scenes and no ScrollTrigger. What stays
 * moving is CSS — the cover intro, the loops (rain, ticker, tape, the red band's marquee, the
 * tongue flicks; paused off screen by offscreen-loops.ts) and, where the browser has scroll-driven
 * animations, the cover turning away, its SFX drifting up and the band's drift (noir.css «LITE
 * MOTION»). This adds the one scroll effect that needs a script: on touch screens, colour comes
 * back to the covers and gallery photos while they are centred (effects.ts litWhenCentred, with
 * the same bands of the viewport) — an IntersectionObserver per band, no work while scrolling.
 */

/** Selector → the band of the viewport (rootMargin) inside which the item is lit. */
const LIT_BANDS: ReadonlyArray<readonly [selector: string, rootMargin: string]> = [
  // CatalogScene: start "top 70%", end "bottom 30%"
  [".cover__card", "-30% 0px -30% 0px"],
  // GalleryScene: start "top 62%", end "bottom 38%"
  [".gal__item", "-38% 0px -38% 0px"],
];

const LIT_CLASS = "is-lit";

/** Starts the lite-mode effects; returns the cleanup. */
export function startLiteMotion(): () => void {
  if (hasFinePointer() || typeof IntersectionObserver === "undefined") return () => undefined;
  const observers = LIT_BANDS.map(([selector, rootMargin]) => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) entry.target.classList.toggle(LIT_CLASS, entry.isIntersecting);
      },
      { rootMargin },
    );
    document.querySelectorAll(selector).forEach((el) => observer.observe(el));
    return { observer, selector };
  });
  return () => {
    for (const { observer, selector } of observers) {
      observer.disconnect();
      document.querySelectorAll(selector).forEach((el) => el.classList.remove(LIT_CLASS));
    }
  };
}
