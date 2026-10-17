// Prints GSAP eases as CSS linear() custom properties for noir.css («COVER INTRO» and the
// collection page's first wipes), so CSS keyframes move exactly like the former GSAP tweens.
//   node scripts/css-eases.mjs   → paste the output into the :root block in noir.css
// Adaptive sampling: every segment stays within the error bound of the real curve (>= 30 stops).
import { gsap } from "gsap";

const EASES = {
  "power3-out": "power3.out",
  "power3-inout": "power3.inOut",
  "power2-inout": "power2.inOut",
  "power4-inout": "power4.inOut",
  "power4-out": "power4.out",
  "back3-out": "back.out(3)",
  "back26-out": "back.out(2.6)",
};
/** The cover frame's dash travels the whole perimeter (~4300 px): its curve is sampled finer. */
const FINE = new Set(["power2-inout"]);
const MIN_STOPS = 30;

const fmt = (value, digits) => {
  const k = 10 ** digits;
  return (Math.round(value * k) / k).toString().replace(/^0\./, ".").replace(/^-0\./, "-.");
};

function stops(f, tol) {
  const points = [0];
  let a = 0;
  while (a < 1) {
    let lo = a, hi = 1, best = a;
    for (let i = 0; i < 40; i++) {
      const b = (lo + hi) / 2;
      let err = 0;
      for (let k = 1; k < 40; k++) {
        const t = a + ((b - a) * k) / 40;
        err = Math.max(err, Math.abs(f(a) + ((f(b) - f(a)) * (t - a)) / (b - a) - f(t)));
      }
      if (err <= tol) { best = b; lo = b; } else hi = b;
    }
    best = Math.max(best, Math.min(1, a + 1e-4));
    if (1 - best < 1e-6) best = 1;
    points.push(best);
    a = best;
  }
  while (points.length < MIN_STOPS) {
    let at = 1, width = 0;
    for (let i = 1; i < points.length; i++) if (points[i] - points[i - 1] > width) { width = points[i] - points[i - 1]; at = i; }
    points.splice(at, 0, (points[at] + points[at - 1]) / 2);
  }
  return points;
}

for (const [name, ease] of Object.entries(EASES)) {
  const f = gsap.parseEase(ease);
  const fine = FINE.has(name);
  const digits = fine ? 4 : 3;
  const points = stops(f, fine ? 0.0003 : 0.0012);
  const parts = points.map((t, i) => (i === 0 || i === points.length - 1 ? fmt(f(t), digits) : `${fmt(f(t), digits)} ${fmt(t * 100, 2)}%`));
  console.log(`  --ease-${name}: linear(${parts.join(", ")});`);
}
