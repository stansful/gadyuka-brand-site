import { describe, expect, it } from 'vitest';

import { lateGate } from './boot';
import { SCENE_LATE_ATTR, SCENE_PENDING_ATTR } from './scene-attrs';

/** A scene root: attributes and a viewport rect. */
class FakeRoot {
  readonly attrs = new Set<string>([SCENE_PENDING_ATTR]);
  constructor(
    readonly name: string,
    readonly top: number,
    readonly height = 600,
  ) {}
  hasAttribute(attr: string): boolean {
    return this.attrs.has(attr);
  }
  setAttribute(attr: string): void {
    this.attrs.add(attr);
  }
  getBoundingClientRect(): { top: number; bottom: number } {
    return { top: this.top, bottom: this.top + this.height };
  }
}

type Listener = { fn: () => void; once: boolean };

/** Runs lateGate(true) against a minimal browser; returns handles to drive it. */
function boot(roots: FakeRoot[]) {
  const listeners = new Map<string, Listener[]>();
  const docListeners = new Map<string, Array<() => void>>();
  const on = (type: string, fn: () => void, options?: { once?: boolean }): void => {
    listeners.set(type, [...(listeners.get(type) ?? []), { fn, once: options?.once === true }]);
  };
  const off = (type: string, fn: () => void): void => {
    listeners.set(
      type,
      (listeners.get(type) ?? []).filter(l => l.fn !== fn),
    );
  };
  const fire = (type: string): void => {
    for (const l of [...(listeners.get(type) ?? [])]) {
      if (l.once) off(type, l.fn);
      l.fn();
    }
  };
  type Entry = { target: FakeRoot; isIntersecting: boolean };
  const observers: Array<{
    cb: (entries: Entry[]) => void;
    options: unknown;
    observed: Set<FakeRoot>;
    disconnected: boolean;
  }> = [];
  class FakeIO {
    readonly record: (typeof observers)[number];
    constructor(cb: (entries: Entry[]) => void, options: unknown) {
      this.record = { cb, options, observed: new Set(), disconnected: false };
      observers.push(this.record);
    }
    observe(t: FakeRoot): void {
      this.record.observed.add(t);
    }
    unobserve(t: FakeRoot): void {
      this.record.observed.delete(t);
    }
    disconnect(): void {
      this.record.disconnected = true;
      this.record.observed.clear();
    }
  }
  const window: { IntersectionObserver: typeof FakeIO; __gadyukaSettled?: boolean } = { IntersectionObserver: FakeIO };
  const document = {
    addEventListener: (type: string, fn: () => void) => docListeners.set(type, [...(docListeners.get(type) ?? []), fn]),
    querySelectorAll: (selector: string) => {
      if (selector === `[${SCENE_PENDING_ATTR}]`) return roots.filter(r => r.hasAttribute(SCENE_PENDING_ATTR));
      if (selector === `[${SCENE_PENDING_ATTR}]:not([${SCENE_LATE_ATTR}])`)
        return roots.filter(r => r.hasAttribute(SCENE_PENDING_ATTR) && !r.hasAttribute(SCENE_LATE_ATTR));
      throw new Error(`unexpected selector ${selector}`);
    },
  };
  const run = new Function(
    'window',
    'document',
    'addEventListener',
    'removeEventListener',
    'IntersectionObserver',
    'innerHeight',
    lateGate(true),
  );
  run(window, document, on, off, FakeIO, 800);
  return {
    window,
    fire,
    dcl: () => (docListeners.get('DOMContentLoaded') ?? []).forEach(fn => fn()),
    io: () => {
      const record = observers[0];
      if (!record) throw new Error('no observer');
      return record;
    },
    late: () => roots.filter(r => r.hasAttribute(SCENE_LATE_ATTR)).map(r => r.name),
  };
}

describe('lateGate (MOTION_BOOT, production)', () => {
  it('is empty when disabled and parses when enabled', () => {
    expect(lateGate(false)).toBe('');
    expect(() => new Function(lateGate(true))).not.toThrow();
  });

  it('observes the pending roots ahead of the screen', () => {
    const page = boot([new FakeRoot('catalog', 900)]);
    page.dcl();
    expect(page.io().options).toEqual({ rootMargin: '50% 0px' });
    expect(page.io().observed.size).toBe(1);
  });

  it('ignores scrolls the visitor did not make (fragment scroll, scroll restoration)', () => {
    const roots = [new FakeRoot('contacts', 0)];
    const page = boot(roots);
    page.fire('scroll'); // the browser's jump to #contacts
    page.dcl();
    page.io().cb([{ target: roots[0]!, isIntersecting: true }]);
    page.fire('scroll');
    expect(page.late()).toEqual([]);
  });

  it("marks the pending roots near the screen at the visitor's first scroll, and the ones scrolled to later", () => {
    const done = new FakeRoot('about-set-up', 100);
    done.attrs.delete(SCENE_PENDING_ATTR);
    const roots = [new FakeRoot('catalog', 100), new FakeRoot('about', 1100), new FakeRoot('tailoring', 3000), done];
    const page = boot(roots);
    page.dcl();
    page.io().cb([{ target: roots[0]!, isIntersecting: true }]); // initial report: not armed yet
    expect(page.late()).toEqual([]);
    page.fire('touchstart');
    page.fire('scroll');
    // swept: on screen + within half a screen below (1100 < 800 × 1.5); not the far one, not a set-up one
    expect(page.late()).toEqual(['catalog', 'about']);
    page.io().cb([{ target: roots[2]!, isIntersecting: true }]);
    expect(page.late()).toEqual(['catalog', 'about', 'tailoring']);
  });

  it('never marks a root that is no longer pending', () => {
    const root = new FakeRoot('news', 0);
    const page = boot([root]);
    page.dcl();
    page.fire('wheel');
    page.fire('scroll');
    root.attrs.clear();
    page.io().cb([{ target: root, isIntersecting: true }]);
    expect(page.late()).toEqual([]);
    expect(page.io().observed.has(root)).toBe(false);
  });

  it('stops once the first scene setups are done', () => {
    const roots = [new FakeRoot('catalog', 100), new FakeRoot('about', 2000)];
    const page = boot(roots);
    page.dcl();
    page.window.__gadyukaSettled = true;
    page.fire('keydown');
    page.fire('scroll');
    expect(page.late()).toEqual([]);
    expect(page.io().disconnected).toBe(true);
  });
});
