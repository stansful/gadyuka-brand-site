import { describe, expect, it } from "vitest";
import { clamp01, dragScroll, grabOffset, headY, isTap, progressAtY, scrollForProgress, scrollProgress, type SpineTrack, stillPress, TAP_MAX_MS, TAP_SLOP_PX, TOUCH_HOLD_MS } from "./spine-math";

const track: SpineTrack = { top: 90, length: 784 };

describe("clamp01", () => {
  it("keeps 0…1 and clamps the rest", () => {
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(1.7)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("scrollProgress / scrollForProgress", () => {
  it("maps the scroll position to the reading progress and back", () => {
    expect(scrollProgress(0, 12000)).toBe(0);
    expect(scrollProgress(3000, 12000)).toBe(0.25);
    expect(scrollProgress(12000, 12000)).toBe(1);
    expect(scrollForProgress(0.5, 12000)).toBe(6000);
    expect(scrollForProgress(scrollProgress(7345, 12000), 12000)).toBeCloseTo(7345, 6);
  });

  it("clamps overscroll and handles a page that does not scroll", () => {
    expect(scrollProgress(-40, 12000)).toBe(0);
    expect(scrollProgress(12080, 12000)).toBe(1);
    expect(scrollProgress(0, 0)).toBe(0);
    expect(scrollForProgress(0.7, 0)).toBe(0);
    expect(scrollForProgress(0.7, -10)).toBe(0);
    expect(scrollForProgress(2, 500)).toBe(500);
  });
});

describe("headY / progressAtY", () => {
  it("puts the head along the track", () => {
    expect(headY(track, 0)).toBe(90);
    expect(headY(track, 0.5)).toBe(90 + 392);
    expect(headY(track, 1)).toBe(874);
  });

  it("is the inverse of headY inside the track and clamps outside it", () => {
    for (const p of [0, 0.1, 0.25, 0.5, 0.99, 1]) expect(progressAtY(track, headY(track, p))).toBeCloseTo(p, 9);
    expect(progressAtY(track, 10)).toBe(0);
    expect(progressAtY(track, 2000)).toBe(1);
  });

  it("returns 0 for a collapsed track", () => {
    expect(progressAtY({ top: 90, length: 0 }, 300)).toBe(0);
    expect(headY({ top: 90, length: -5 }, 0.5)).toBe(90);
  });
});

describe("grabOffset / dragScroll", () => {
  it("keeps the grab offset: the head does not jump under the pointer", () => {
    const max = 10000;
    const progress = 0.3;
    const pointerDown = headY(track, progress) + 11; // grabbed 11 px below the head's centre
    const offset = grabOffset(track, progress, pointerDown);
    expect(offset).toBeCloseTo(11, 9);
    // no movement: the page stays where it was
    expect(dragScroll(track, pointerDown, offset, max)).toBeCloseTo(3000, 6);
    // the pointer moves a quarter of the track down: a quarter of the page further
    expect(dragScroll(track, pointerDown + track.length / 4, offset, max)).toBeCloseTo(5500, 6);
  });

  it("drags 1:1 to the ends", () => {
    const max = 8000;
    expect(dragScroll(track, track.top + track.length * 0.25, 0, max)).toBeCloseTo(2000, 6);
    expect(dragScroll(track, track.top + track.length * 0.5, 0, max)).toBeCloseTo(4000, 6);
    expect(dragScroll(track, track.top + track.length + 300, 0, max)).toBe(8000);
    expect(dragScroll(track, -200, 0, max)).toBe(0);
  });
});

describe("isTap", () => {
  it("is a short press that stays put", () => {
    expect(isTap(0, 0, 90)).toBe(true);
    expect(isTap(3, -4, 200)).toBe(true);
    expect(isTap(0, TAP_SLOP_PX - 0.5, TAP_MAX_MS)).toBe(true);
  });

  it("is not a swipe, a resting thumb or a held press", () => {
    expect(isTap(0, TAP_SLOP_PX, 90)).toBe(false);
    expect(isTap(-8, 8, 90)).toBe(false);
    expect(isTap(0, 0, TAP_MAX_MS + 1)).toBe(false);
    expect(isTap(0, 0, -1)).toBe(false);
    expect(isTap(Number.NaN, 0, 90)).toBe(false);
  });
});

describe("stillPress (touch: the head is taken only by a finger held still)", () => {
  it("counts small jitter as still, a swipe as moving", () => {
    expect(stillPress(0, 0)).toBe(true);
    expect(stillPress(4, -6)).toBe(true);
    expect(stillPress(0, TAP_SLOP_PX)).toBe(false);
    expect(stillPress(-30, 120)).toBe(false);
  });

  it("asks for a deliberate hold, shorter than Android's long press", () => {
    expect(TOUCH_HOLD_MS).toBeGreaterThanOrEqual(250);
    expect(TOUCH_HOLD_MS).toBeLessThan(500);
  });
});
