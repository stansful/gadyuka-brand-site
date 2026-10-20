import { describe, expect, it, vi } from 'vitest';

import { TAP_GUARD } from './boot';
import {
  TAP_AFTER_END_MS,
  TAP_MOVE_MIN_PX,
  TAP_MOVING_MS,
  TAP_SLOP_PX,
  TAP_STALL_MARGIN_MS,
  TAP_TRAVEL_PX,
} from './tap-guard';

/** A nested scroller (the mobile menu, a row of collection covers) and what it holds. */
class FakeScroller {
  readonly nodeType = 1;
  scrollLeft = 0;
  scrollTop = 0;
  readonly kids = new Set<object>();
  contains(node: object): boolean {
    return node === this || this.kids.has(node);
  }
}

/** An element of the page outside the nested scrollers. */
class FakeNode {
  readonly nodeType = 1;
  contains(node: object): boolean {
    return node === this;
  }
}

type Handler = (event: Record<string, unknown>) => void;
type BootWindow = {
  scrollY: number;
  __gadyukaTapsBlocked?: number;
  __gadyukaScrollAt?: number;
  __gadyukaInput?: boolean;
};

/** Runs TAP_GUARD against a minimal browser; returns handles to drive it. */
function boot() {
  const handlers = new Map<string, Array<{ fn: Handler; once: boolean }>>();
  const clock = { now: 0 };
  const d = {};
  const document = {};
  const window: BootWindow = { scrollY: 0 };
  const on = (type: string, fn: Handler, options?: boolean | { once?: boolean }): void => {
    const once = typeof options === 'object' && options.once === true;
    handlers.set(type, [...(handlers.get(type) ?? []), { fn, once }]);
  };
  const run = new Function('d', 'document', 'window', 'addEventListener', 'performance', TAP_GUARD);
  run(d, document, window, on, { now: () => clock.now });
  const fire = (type: string, event: Record<string, unknown>): void => {
    const list = handlers.get(type);
    if (!list?.length) throw new Error(`no ${type} listener`);
    for (const l of [...list]) {
      if (l.once)
        handlers.set(
          type,
          (handlers.get(type) ?? []).filter(x => x !== l),
        );
      l.fn({ type, ...event });
    }
  };
  const page = new FakeNode();
  /** Fires a cancelable event; true when it went through. */
  const cancelable = (type: string, event: Record<string, unknown>): boolean => {
    const preventDefault = vi.fn();
    const stopImmediatePropagation = vi.fn();
    fire(type, { target: page, detail: 1, ...event, preventDefault, stopImmediatePropagation });
    const blocked = preventDefault.mock.calls.length > 0;
    expect(stopImmediatePropagation.mock.calls.length > 0).toBe(blocked);
    return !blocked;
  };
  return {
    window,
    page,
    at: (ms: number) => {
      clock.now = ms;
    },
    /** A scroll frame of the page (the window's scrollY moves by `by`) or of a nested scroller. */
    scroll: (by = 40, target?: FakeScroller) => {
      if (target) {
        target.scrollLeft += by;
        fire('scroll', { target });
      } else {
        window.scrollY += by;
        fire('scroll', { target: document });
      }
    },
    /** A finger (identifier 0) put down at (x, y); `stamp` is when it landed (its event's timeStamp). */
    touch: (target: object = page, x = 100, y = 400, stamp?: number) =>
      fire('touchstart', {
        target,
        timeStamp: stamp ?? clock.now,
        changedTouches: [{ identifier: 0, clientX: x, clientY: y }],
      }),
    move: (x: number, y: number, id = 0) =>
      fire('touchmove', { changedTouches: [{ identifier: id, clientX: x, clientY: y }] }),
    lift: (x = 100, y = 400, id = 0) =>
      fire('touchend', { changedTouches: [{ identifier: id, clientX: x, clientY: y }] }),
    click: (event: Record<string, unknown> = {}) => cancelable('click', event),
    mousedown: (event: Record<string, unknown> = {}) => cancelable('mousedown', event),
  };
}

describe('tap guard', () => {
  it('lets a tap on a page at rest through (its mousedown too)', () => {
    const g = boot();
    g.at(1000);
    g.scroll();
    g.at(1000 + TAP_MOVING_MS + 200);
    g.touch();
    g.lift();
    expect(g.mousedown()).toBe(true);
    expect(g.click()).toBe(true);
    expect(g.window.__gadyukaTapsBlocked).toBeUndefined();
  });

  it('cancels the mousedown and the click of a touch that landed on a moving page (a fling)', () => {
    const g = boot();
    g.at(1000);
    g.scroll();
    expect(g.window.__gadyukaScrollAt).toBe(1000);
    g.at(1000 + TAP_MOVING_MS - 20);
    g.touch();
    g.lift();
    // the mousedown is judged without using the touch up: its click is cancelled as well
    expect(g.mousedown()).toBe(false);
    expect(g.click()).toBe(false);
    expect(g.window.__gadyukaTapsBlocked).toBe(1);
  });

  it('does not count scroll frames of a pixel or two (the end of an anchor tween) as moving', () => {
    const g = boot();
    g.at(1000);
    g.scroll(TAP_MOVE_MIN_PX - 1);
    g.at(1016);
    g.scroll(TAP_MOVE_MIN_PX - 1);
    expect(g.window.__gadyukaScrollAt).toBeUndefined();
    g.at(1050);
    g.touch();
    g.lift();
    expect(g.click()).toBe(true);
  });

  it('widens the moving window by the delay of a late touchstart (a busy main thread)', () => {
    const g = boot();
    g.at(1000);
    g.scroll();
    // the finger landed at 1300 while the main thread was busy; its touchstart runs at 1450
    g.at(1450);
    g.touch(g.page, 100, 400, 1300);
    g.lift();
    expect(g.click()).toBe(false);
    // the same delay with no scroll frame for long before it: a tap
    const h = boot();
    h.at(1000);
    h.scroll();
    // handled 110 ms late: the window is TAP_MOVING_MS + 110 + TAP_STALL_MARGIN_MS, the last frame older
    const late = 110;
    h.at(1000 + TAP_MOVING_MS + late + TAP_STALL_MARGIN_MS + 100);
    h.touch(h.page, 100, 400, 1000 + TAP_MOVING_MS + TAP_STALL_MARGIN_MS + 100);
    h.lift();
    expect(h.click()).toBe(true);
  });

  it('cancels the click of a touch that moved the page before the finger lifted (a flick)', () => {
    const g = boot();
    g.at(5000);
    g.touch();
    g.window.scrollY = TAP_SLOP_PX + 400;
    g.at(5060);
    g.lift();
    expect(g.click()).toBe(false);
  });

  it('measures the page moving up to the lift, not what the tap itself shifts before its click', () => {
    const g = boot();
    g.at(5000);
    g.touch();
    g.lift();
    // the tap's mousedown blurred a field: an error line inserted above moved the page (scroll anchoring)
    g.window.scrollY = 24;
    expect(g.click()).toBe(true);
  });

  it('lets a tap through when the page only shifted within the slop', () => {
    const g = boot();
    g.at(5000);
    g.touch();
    g.window.scrollY = TAP_SLOP_PX;
    g.lift();
    expect(g.click()).toBe(true);
  });

  it('cancels the click of a whole flick taken for a tap (its finger travelled, the page still)', () => {
    const g = boot();
    g.at(5000);
    g.touch(g.page, 200, 700);
    g.at(5060);
    g.lift(200, 700 - (TAP_TRAVEL_PX + 300));
    expect(g.mousedown()).toBe(false);
    expect(g.click()).toBe(false);
  });

  it('cancels the click when the finger went away and came back', () => {
    const g = boot();
    g.at(5000);
    g.touch(g.page, 200, 700);
    g.move(200, 700 - TAP_TRAVEL_PX - 40);
    g.lift(201, 702);
    expect(g.click()).toBe(false);
  });

  it('lets a tap through when the finger only wobbled within the slop', () => {
    const g = boot();
    g.at(5000);
    g.touch(g.page, 200, 700);
    g.move(210, 690);
    g.lift(212, 688);
    expect(g.click()).toBe(true);
  });

  it('follows the finger of the latest touchstart, not another one', () => {
    const g = boot();
    g.at(5000);
    g.touch(g.page, 200, 700);
    g.lift(900, 100, 7);
    g.lift(200, 700);
    expect(g.click()).toBe(true);
  });

  it("never judges a keyboard click, a mouse / pen click or a mouse's mousedown", () => {
    const g = boot();
    g.at(1000);
    g.scroll();
    g.touch();
    g.lift();
    expect(g.click({ detail: 0 })).toBe(true);
    // a touch laptop: a finger swipe, then the trackpad
    expect(g.mousedown({ sourceCapabilities: { firesTouchEvents: false } })).toBe(true);
    expect(g.click({ pointerType: 'mouse' })).toBe(true);
    expect(g.click({ pointerType: 'pen' })).toBe(true);
    // its own touch click is still judged
    expect(g.click({ pointerType: 'touch' })).toBe(false);
  });

  it("judges only events within TAP_AFTER_END_MS of the touch's lift, and one click per touch", () => {
    const g = boot();
    g.at(1000);
    g.scroll();
    g.touch();
    g.lift();
    g.at(1000 + TAP_AFTER_END_MS + 1);
    expect(g.click()).toBe(true);
    g.at(4000);
    g.scroll();
    g.touch();
    g.lift();
    expect(g.click()).toBe(false);
    // a second click with no touch of its own (a script's, a label's) is not that touch's
    expect(g.click()).toBe(true);
    // a swipe that ended without a click: a click without a lift is not judged
    g.at(6000);
    g.scroll();
    g.touch();
    expect(g.click()).toBe(true);
  });

  it('counts a nested scroller moving only for touches inside it', () => {
    const g = boot();
    const covers = new FakeScroller();
    const cover = new FakeNode();
    covers.kids.add(cover);
    g.at(2000);
    g.scroll(40, covers);
    g.at(2016);
    g.scroll(40, covers);
    g.at(2050);
    g.touch(cover);
    g.lift();
    expect(g.click({ target: cover })).toBe(false);
    g.touch(g.page);
    g.lift();
    expect(g.click()).toBe(true);
  });

  it('cancels the click of a touch that swiped a nested scroller', () => {
    const g = boot();
    const covers = new FakeScroller();
    const cover = new FakeNode();
    covers.kids.add(cover);
    g.at(2000);
    g.scroll(40, covers);
    g.at(3000);
    g.touch(cover);
    covers.scrollLeft += 240;
    g.at(3080);
    g.lift();
    expect(g.click({ target: cover })).toBe(false);
  });

  it('cancels the click of a touch on a row that started scrolling during it (not the last scroller before)', () => {
    const g = boot();
    const rowA = new FakeScroller();
    const rowB = new FakeScroller();
    const cover = new FakeNode();
    rowB.kids.add(cover);
    g.at(1000);
    g.scroll(40, rowA);
    g.at(3000);
    g.touch(cover);
    g.at(3016);
    g.scroll(60, rowB);
    g.at(3032);
    g.scroll(60, rowB);
    g.lift();
    expect(g.click({ target: cover })).toBe(false);
  });

  it("notes the visitor's first input from the first script", () => {
    const g = boot();
    expect(g.window.__gadyukaInput).toBeUndefined();
    g.touch();
    expect(g.window.__gadyukaInput).toBe(true);
  });
});
