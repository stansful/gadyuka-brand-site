import type Lenis from "lenis";

/**
 * The page's Lenis instance (null with reduced motion / before mount). A tiny module store
 * instead of React context: the mobile menu and the lightbox only need to stop/start it.
 */
let current: Lenis | null = null;

/** On <html> while page scrolling is frozen: noir.css hides the scroll snake (it would show through). */
export const SCROLL_LOCKED_CLASS = "scroll-locked";

export function setLenis(instance: Lenis | null): void {
  current = instance;
}

export function getLenis(): Lenis | null {
  return current;
}

/** Freeze / unfreeze page scrolling (menu overlay, lightbox). */
export function lockScroll(locked: boolean): void {
  if (locked) current?.stop();
  else current?.start();
  document.body.style.overflow = locked ? "hidden" : "";
  document.documentElement.classList.toggle(SCROLL_LOCKED_CLASS, locked);
}
