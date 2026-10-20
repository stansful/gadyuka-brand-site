import { describe, expect, it } from "vitest";
import { heightChangeNeedsRefresh, refreshDecision, TOUCH_MIN_HEIGHT_DELTA, TOUCH_STILL_MS } from "./refresh-gate";

const still = { touch: true, activeTouches: 0, stillForMs: TOUCH_STILL_MS + 1, hidden: false };

describe("refreshDecision", () => {
  it("keeps GSAP's safe refresh for mouse / trackpad", () => {
    expect(refreshDecision({ ...still, touch: false, activeTouches: 1, stillForMs: 0 })).toEqual({ kind: "safe" });
  });

  it("refreshes a touch screen's page at once when it has been still long enough", () => {
    expect(refreshDecision(still)).toEqual({ kind: "now" });
  });

  it("waits while a finger is on the screen", () => {
    expect(refreshDecision({ ...still, activeTouches: 1 })).toEqual({ kind: "wait", ms: TOUCH_STILL_MS });
  });

  it("waits out the rest of the still period after a scroll (fling momentum included)", () => {
    expect(refreshDecision({ ...still, stillForMs: 300 })).toEqual({ kind: "wait", ms: TOUCH_STILL_MS - 300 });
    // never re-checks sooner than 150 ms
    expect(refreshDecision({ ...still, stillForMs: TOUCH_STILL_MS - 10 })).toEqual({ kind: "wait", ms: 150 });
  });

  it("waits while the page is hidden", () => {
    expect(refreshDecision({ ...still, hidden: true })).toEqual({ kind: "wait", ms: TOUCH_STILL_MS });
  });
});

describe("heightChangeNeedsRefresh", () => {
  it("always refreshes with mouse / trackpad", () => {
    expect(heightChangeNeedsRefresh(false, 15000, 14999)).toBe(true);
  });

  it("skips small changes on touch screens, counted from the last refreshed height", () => {
    expect(heightChangeNeedsRefresh(true, 15113, 15090)).toBe(false); // the 23 px seen on the phone
    expect(heightChangeNeedsRefresh(true, 15000 + TOUCH_MIN_HEIGHT_DELTA, 15000)).toBe(true);
    expect(heightChangeNeedsRefresh(true, 14540, 15000)).toBe(true); // the lead form's success shrinks the page
  });
});
