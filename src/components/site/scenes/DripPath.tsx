"use client";

import type { ReactElement } from "react";

/** Small deterministic PRNG (mulberry32): the same drip on the server and in the browser. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ink drips along the bottom edge of the snake's reveal mask (the logo viewBox is 1360 wide):
 * a white block that ends in drops, moved down over the logo by the cover intro (CSS).
 * Formerly random per page view; seeded now, so it is in the server HTML for the first paint.
 */
function dripPath(seed: number): string {
  const random = mulberry32(seed);
  const width = 1360;
  const rnd = (a: number, b: number): number => a + random() * (b - a);
  const f = (n: number): string => n.toFixed(1);
  let d = `M-100 -3000H${width + 100}V0`;
  let x = width + 100;
  while (x > -60) {
    const gap = rnd(24, 90);
    const w = rnd(22, 64);
    const len = rnd(50, 300);
    const x1 = x - gap;
    const x2 = x1 - w;
    d += ` L${f(x1)} 0 C${f(x1)} ${f(len * 0.55)} ${f(x1 - w * 0.08)} ${f(len)} ${f(x1 - w / 2)} ${f(len)}`;
    d += ` C${f(x2 + w * 0.08)} ${f(len)} ${f(x2)} ${f(len * 0.55)} ${f(x2)} 0`;
    x = x2;
  }
  return `${d} L-100 0Z`;
}

const DRIP = dripPath(0x9a3d1c);

/**
 * The drip shape of the snake's reveal mask. A client component on purpose: it is rendered into
 * the server HTML like any other, but its ~1.3 KB of path data is computed here (identically on
 * both sides) instead of travelling a second time in the RSC payload.
 */
export function DripPath(): ReactElement {
  return <path fill="#fff" d={DRIP} />;
}
