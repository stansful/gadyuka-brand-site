/**
 * Geometry of the scroll snake (ScrollSpine) — the page's scrollbar: the spine is the track, the
 * head the thumb. Pure (unit-tested): viewport y ↔ reading progress ↔ scroll position.
 */

/** The track in viewport px: where the head sits at progress 0, and how far it travels to 1. */
export type SpineTrack = { readonly top: number; readonly length: number };

/** `value` within 0…1 (0 for NaN). */
export function clamp01(value: number): number {
  if (!(value > 0)) return 0;
  return value < 1 ? value : 1;
}

/** Reading progress: scroll position / maximum scroll, 0…1 (0 when the page does not scroll). */
export function scrollProgress(scrollTop: number, maxScroll: number): number {
  return maxScroll > 0 ? clamp01(scrollTop / maxScroll) : 0;
}

/** Scroll position of a progress. */
export function scrollForProgress(progress: number, maxScroll: number): number {
  return clamp01(progress) * Math.max(0, maxScroll);
}

/** Viewport y of the head at a progress. */
export function headY(track: SpineTrack, progress: number): number {
  return track.top + clamp01(progress) * Math.max(0, track.length);
}

/** Progress that puts the head at viewport y (clamped to the ends of the track). */
export function progressAtY(track: SpineTrack, y: number): number {
  return track.length > 0 ? clamp01((y - track.top) / track.length) : 0;
}

/**
 * Grab offset of a press on the head: how far below the head's centre the pointer went down. The
 * drag keeps it (the head follows the pointer 1:1 without first jumping under it).
 */
export function grabOffset(track: SpineTrack, progress: number, pointerY: number): number {
  return pointerY - headY(track, progress);
}

/** Scroll position for a dragging pointer at viewport y holding the head `offset` px off its centre. */
export function dragScroll(track: SpineTrack, pointerY: number, offset: number, maxScroll: number): number {
  return scrollForProgress(progressAtY(track, pointerY - offset), maxScroll);
}

/** A finger that moved less than this (px) since it went down is still holding its place. */
export const TAP_SLOP_PX = 10;
/** …and lifted within this (ms) — a thumb resting on the edge, or held there, is not a tap. */
export const TAP_MAX_MS = 500;

/** Whether a touch lifted `dx`, `dy` px from where it went down, `ms` later, was a tap. */
export function isTap(dx: number, dy: number, ms: number): boolean {
  return Math.hypot(dx, dy) < TAP_SLOP_PX && ms >= 0 && ms <= TAP_MAX_MS;
}

/**
 * Touch screens: a finger takes the head only after holding it this long (ms) without moving
 * (stillPress) — a swipe that merely starts on the head is the page's own scroll. (Grabbed at
 * once, a thumb swiping near the right edge threw the page many screens away: the head maps the
 * whole page onto the track.)
 */
export const TOUCH_HOLD_MS = 300;

/** Whether a finger `dx`, `dy` px from where it went down still counts as holding still. */
export function stillPress(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) < TAP_SLOP_PX;
}
