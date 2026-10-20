/**
 * Window events shared by the public client components (a tiny module: importing it does not
 * pull SmoothScroll or the menu into another chunk).
 */

/** Dispatched on window right before an in-page anchor scroll (the mobile menu closes on it). */
export const NAVIGATE_EVENT = 'gadyuka:navigate';
