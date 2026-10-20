/**
 * On <html> while the scroll snake (ScrollSpine) is the page's scrollbar: noir.css hides the
 * native one («SCROLL SPINE»). Set before the first paint by MOTION_BOOT (motion/boot.ts) and by
 * ScrollSpine itself for pages the client renders on its own (the not-found / error pages).
 * Without JS neither runs: the native scrollbar stays and the snake is not drawn.
 */
export const SCROLLBAR_CLASS = "snake-bar";

/**
 * On <html> once the snake's script runs (ScrollSpine). MOTION_BOOT's failsafe takes
 * SCROLLBAR_CLASS off again — the native scrollbar back, the snake hidden — when it is still
 * missing SCROLLBAR_FAILSAFE_MS after `load` (the app bundle blocked or failed to load).
 */
export const SCROLLBAR_READY_CLASS = "snake-ready";

/** How long after `load` MOTION_BOOT waits for SCROLLBAR_READY_CLASS (ms). */
export const SCROLLBAR_FAILSAFE_MS = 4000;

/**
 * On <html> when the snake is switched off for diagnostics (`?snake=0`, MOTION_BOOT): the native
 * scrollbar stays, the snake is not drawn (noir.css) and ScrollSpine does not take over.
 */
export const SNAKE_OFF_CLASS = "snake-off";
