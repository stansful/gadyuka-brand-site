import type { ScrollTrigger } from "gsap/ScrollTrigger";
import { layoutTop } from "./dom-utils";
import { gsap, scrollTrigger, splitText } from "./gsap";
import { hasFinePointer } from "./env";

/**
 * Animation building blocks ported from concepts/01-noir-comic/app.js. Every function is
 * meant to run INSIDE a gsap.context() (see useScene): tweens, ScrollTriggers and SplitTexts
 * it creates are recorded and reverted on unmount. They run in scene setups, i.e. after
 * ScrollTrigger was loaded (gsap.ts loadScrollTrigger, awaited by the scene scheduler). Callbacks that fire later (ScrollTrigger
 * batches, pointer events) wrap their work in `ctx.add()` so it is recorded as well.
 */

type Ctx = gsap.Context;

/**
 * True while a "late" scene is set up (useScene): its root came near the screen before the setup
 * could run (SCENE_LATE_ATTR — the app bundle still loading on a cold visit, the visitor already
 * scrolling), or the boot failsafe had dropped the CSS start states. Its content is drawn as
 * server-rendered, so what the visitor may already have seen must not be hidden again and played
 * in under the finger — see unseen().
 */
let revealsSuppressed = false;

/**
 * The elements of `list` whose one-shot reveal may run. In a late scene that is only those still
 * below the fold at setup: their start state is written while they are off screen (nobody sees
 * it) and they reveal as usual; the ones on screen or above stay as rendered. Elsewhere: all.
 * (A per-element decision: one scene root can span many screens — the collection page.)
 */
export function unseen<T extends Element>(list: T[]): T[] {
  if (!revealsSuppressed || list.length === 0) return list;
  const fold = window.innerHeight;
  return list.filter((el) => el.getBoundingClientRect().top >= fold);
}

/** Runs `fn` (a scene setup) with late-scene reveals (unseen()) when `late`. */
export function withRevealsOff<T>(late: boolean, fn: () => T): T {
  const previous = revealsSuppressed;
  revealsSuppressed = late;
  try {
    return fn();
  } finally {
    revealsSuppressed = previous;
  }
}

/** Runs `fn` inside the context, so late tweens are reverted with it. */
export function inContext<A extends unknown[]>(ctx: Ctx, fn: (...args: A) => void): (...args: A) => void {
  return (...args: A) => {
    if (!ctx.isReverted) ctx.add(() => fn(...args));
  };
}

/**
 * One-shot reveal triggers are killed once they fired (the animation plays on): fewer live
 * ScrollTriggers to update on every scroll. Deferred to the next frame — a trigger must not
 * remove itself while ScrollTrigger is still walking its list (refresh on creation, update).
 * Scrub and toggle triggers stay.
 */
export function retire(self: ScrollTrigger): void {
  window.requestAnimationFrame(() => self.kill(false, true));
}

function retireAll(triggers: ScrollTrigger[]): void {
  window.requestAnimationFrame(() => triggers.forEach((trigger) => trigger.kill(false, true)));
}

const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode): T[] =>
  Array.from(root.querySelectorAll<T>(selector));

/**
 * Caption is "typed": the plate unrolls, then characters appear one by one behind a caret.
 *
 * The caption is split only when the typing starts (the plate, scaled to 0 until `at`, hides it
 * before): SplitText marks every char aria-hidden and names the <p> with aria-label, which
 * screen readers ignore on a paragraph — splitting at setup would silence every caption not yet
 * scrolled to. The callback runs inside the timeline's gsap.context, so the split and the tween
 * are still reverted with the scene.
 */
export function typeIn(el: HTMLElement, at: number, tl: gsap.core.Timeline): void {
  tl.fromTo(el, { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 0.35, ease: "power3.out" }, at);
  tl.call(
    () => {
      const split = splitText().create(el, { type: "words,chars" });
      // Start state set once for all chars, then a plain to(): GSAP reads the start from its
      // own inline value instead of computing every char's style (no forced recalc per char).
      gsap.set(split.chars, { opacity: 0 });
      gsap.to(split.chars, {
        opacity: 1,
        duration: 0.01,
        stagger: 0.032,
        ease: "none",
        delay: 0.25,
        onComplete: () => {
          el.classList.remove("is-typing");
          split.revert();
        },
      });
    },
    undefined,
    at,
  );
  tl.call(() => el.classList.add("is-typing"), undefined, at + 0.2);
}

const WIPES = {
  left: ["inset(0% 100% 0% 0%)", "inset(0% 0% 0% 0%)"],
  right: ["inset(0% 0% 0% 100%)", "inset(0% 0% 0% 0%)"],
  up: ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"],
  down: ["inset(0% 0% 100% 0%)", "inset(0% 0% 0% 0%)"],
  diag: ["polygon(0% 0%, 0% 0%, 0% 0%)", "polygon(0% 0%, 200% 0%, 0% 200%)"],
} as const;

type WipeName = keyof typeof WIPES;

function isWipeName(name: string): name is WipeName {
  return Object.hasOwn(WIPES, name);
}

function wipeOf(el: HTMLElement): readonly [string, string] {
  const name = el.dataset.wipe;
  return name && isWipeName(name) ? WIPES[name] : WIPES.left;
}

/**
 * Reveal-once bookkeeping (the concept avoids `once: true`, which can self-kill triggers
 * while ScrollTrigger is still refreshing the list on creation).
 */
function createRevealTracker() {
  const revealed = new WeakSet<Element>();
  /** Elements not revealed yet (marks them revealed). */
  const fresh = <T extends Element>(list: T[]): T[] =>
    list.filter((el) => {
      if (revealed.has(el)) return false;
      revealed.add(el);
      return true;
    });
  /** Already on screen (or scrolled past) at init: batch callbacks can arrive late then. */
  const passed = (el: Element, k: number): boolean => el.getBoundingClientRect().top < window.innerHeight * k;
  /** Not scrolled past yet (still on screen or below). */
  const notAbove = (el: Element): boolean => el.getBoundingClientRect().bottom > 0;
  /**
   * Elements already scrolled past are shown instantly; only on-screen ones animate.
   * `below`: the result of notAbove() measured earlier (before the start states were written,
   * so the measuring did not force a style recalc).
   */
  const onScreen = <T extends Element>(list: T[], instant: (el: T) => void, below?: ReadonlySet<Element>): T[] =>
    list.filter((el) => {
      if (below ? below.has(el) : notAbove(el)) return true;
      instant(el);
      return false;
    });
  return { fresh, passed, notAbove, onScreen };
}

const TITLE_INK_FROM: gsap.TweenVars = { yPercent: 115, rotation: 8 };
/** … and are inked up into place one by one. */
const TITLE_INK_TO: gsap.TweenVars = { yPercent: 0, rotation: 0, duration: 0.95, stagger: 0.022, ease: "power4.out" };

/**
 * Chapter header: a beige sheet is turned away, the title is inked letter by letter, the narration typed.
 *
 * The title is split into masked lines when the reveal starts, while the sheet still covers
 * it — lines measured at setup would be stale after a rotation, a resize or a late font swap
 * (words then wrap inside a line mask and pushed-down chars show through the next row).
 */
export function chapterReveal(root: ParentNode): void {
  for (const chapter of unseen($$(".chapter", root))) {
    const title = chapter.querySelector<HTMLElement>(".chapter__title");
    const sheet = chapter.querySelector<HTMLElement>(".chapter__sheet");
    const no = chapter.querySelector<HTMLElement>(".chapter__no");
    const cap = chapter.querySelector<HTMLElement>(".chapter__cap");
    if (!title) continue;
    const tl = gsap.timeline({ scrollTrigger: { trigger: chapter, start: "top 80%", onEnter: retire } });
    if (sheet) {
      gsap.set(sheet, { opacity: 1, clipPath: "polygon(0% 0%, 200% 0%, 0% 200%)" });
      tl.to(sheet, { clipPath: "polygon(0% 0%, 0% 0%, 0% 0%)", duration: 1.1, ease: "power3.inOut" }, 0);
    }
    if (no) tl.from(no, { x: -30, opacity: 0, duration: 0.7 }, 0.35);
    // Start states are set once (gsap.set), then the chars tween to their natural place:
    // to() reads the start from GSAP's cache — from() would compute every char's style.
    const inkTitle = (delay: number): void => {
      const split = splitText().create(title, { type: "lines,words,chars", mask: "lines" });
      gsap.set(split.chars, TITLE_INK_FROM);
      gsap.to(split.chars, { ...TITLE_INK_TO, delay, onComplete: () => split.revert() });
    };
    if (sheet) {
      // Runs inside the timeline's context (reverted with the scene).
      tl.call(() => inkTitle(0.35), undefined, 0);
    } else {
      // Nothing covers the title before the reveal: hide its chars right away (split at setup).
      const split = splitText().create(title, { type: "lines,words,chars", mask: "lines" });
      gsap.set(split.chars, TITLE_INK_FROM);
      tl.to(split.chars, { ...TITLE_INK_TO, onComplete: () => split.revert() }, 0.35);
    }
    if (cap) typeIn(cap, 0.8, tl);
  }
}

/** Panels: ink spreads in (clip-path wipe), the photo settles, panel captions are typed. */
export function panelWipes(root: ParentNode, ctx: Ctx): void {
  // [data-wipe-now]: first-viewport panels of the collection page, wiped in by CSS from the
  // first paint (noir.css) with the same geometry and timing.
  const panels = unseen($$("[data-wipe]:not([data-wipe-now])", root));
  if (panels.length === 0) return;
  const { fresh, passed, notAbove, onScreen } = createRevealTracker();
  // All reads first (one layout), then the writes: no forced style recalc per panel.
  const initial = panels.filter((el) => passed(el, 0.88));
  const initialBelow = new Set(initial.filter(notAbove));
  // One set() per start shape: GSAP reads every target's current value before it writes any,
  // so each group costs one style recalc instead of one per panel.
  const byStart = new Map<string, HTMLElement[]>();
  for (const el of panels) {
    const start = wipeOf(el)[0];
    byStart.set(start, [...(byStart.get(start) ?? []), el]);
  }
  byStart.forEach((els, start) => gsap.set(els, { clipPath: start }));
  const reveal = inContext(ctx, (list: HTMLElement[], below?: ReadonlySet<Element>) => {
    onScreen(fresh(list), (el) => gsap.set(el, { clearProps: "clipPath" }), below).forEach((el, n) => {
      const i = Math.min(n, 4);
      gsap.to(el, { clipPath: wipeOf(el)[1], duration: 1.15, delay: i * 0.13, ease: "power3.inOut", clearProps: "clipPath" });
      const img = el.querySelector(".media img");
      if (img) gsap.from(img, { scale: 1.22, duration: 1.6, delay: i * 0.13, ease: "power3.out", clearProps: "transform" });
      $$(".panel__cap, .closeup__cap", el).forEach((cap) => typeIn(cap, 0, gsap.timeline({ delay: 0.7 + i * 0.13 })));
    });
  });
  scrollTrigger().batch(panels, {
    start: "top 88%",
    onEnter: (batch, triggers) => {
      reveal(batch.filter(isHTMLElement));
      retireAll(triggers);
    },
  });
  reveal(initial, initialBelow);
}

/**
 * Generic reveal for lead paragraphs. Explicit start and end (not from()): before setup the
 * start state may come from CSS (data-scene-pending), and from() would take that hidden state as
 * its end value.
 */
export function genericReveals(root: ParentNode): void {
  const els = unseen($$("[data-reveal]", root));
  if (els.length === 0) return;
  // Start state for all at once, then a to() each: no computed-style read per element.
  gsap.set(els, { y: 40, opacity: 0 });
  for (const el of els) {
    gsap.to(el, { y: 0, opacity: 1, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%", onEnter: retire } });
  }
}

/**
 * Items fall onto the table one after another (covers, coupons).
 * `fromLayout`: the drop starts when the item's untransformed box reaches 92 % of the viewport
 * (not its lowered starting position). The concept gets this for the coupons by accident — their
 * CSS transform transition delays the lowering past ScrollTrigger's synchronous measurement —
 * so they drop in about 120 px of scroll earlier than the covers do.
 */
export function dropIn(
  root: ParentNode,
  ctx: Ctx,
  selector: string,
  from: gsap.TweenVars,
  to: gsap.TweenVars,
  clearInstant: string,
  fromLayout = false,
): void {
  const items = unseen($$(selector, root));
  if (items.length === 0) return;
  const { fresh, passed, notAbove, onScreen } = createRevealTracker();
  gsap.set(items, from);
  const drop = inContext(ctx, (batch: HTMLElement[], below?: ReadonlySet<Element>) => {
    const list = onScreen(fresh(batch), (el) => gsap.set(el, { clearProps: clearInstant }), below);
    if (list.length) gsap.to(list, { ...to, clearProps: "transform" });
  });
  const start = fromLayout
    ? (self: ScrollTrigger): number =>
        self.trigger instanceof HTMLElement ? layoutTop(self.trigger) - window.innerHeight * 0.92 : 0
    : "top 92%";
  scrollTrigger().batch(items, {
    start,
    onEnter: (batch, triggers) => {
      drop(batch.filter(isHTMLElement));
      retireAll(triggers);
    },
  });
  // Measured after the start state (the lowered position counts, as before), all at once.
  const isPassed = (el: HTMLElement): boolean =>
    fromLayout ? layoutTop(el) - window.scrollY < window.innerHeight * 0.92 : passed(el, 0.92);
  const initial = items.filter(isPassed);
  drop(initial, new Set(initial.filter(notAbove)));
}

/** Comic SFX words: pop in, then drift up with the scroll. */
export function sfxPop(root: ParentNode): void {
  // A late scene leaves the SFX already seen where they were rendered (no pop, and no drift that
  // would move a visible SFX at setup).
  for (const sfx of unseen($$(".page .sfx", root))) {
    gsap.from(sfx, { scale: 0, rotation: -35, opacity: 0, duration: 0.8, ease: "back.out(3)", scrollTrigger: { trigger: sfx, start: "top 85%", onEnter: retire } });
    gsap.to(sfx, {
      yPercent: -60,
      ease: "none",
      scrollTrigger: { trigger: sfx.closest(".panel") ?? sfx, start: "top bottom", end: "bottom top", scrub: 0.5 },
    });
  }
}

/** Touch screens: colour comes back while an item is centred (hover does it on desktop). */
export function litWhenCentred(root: ParentNode, selector: string, start: string, end: string): void {
  if (hasFinePointer()) return;
  for (const el of $$(selector, root)) scrollTrigger().create({ trigger: el, start, end, toggleClass: "is-lit" });
}

/** Cover tilt under the mouse (fine pointers only). */
export function coverTilt(root: ParentNode, ctx: Ctx): void {
  if (!hasFinePointer()) return;
  for (const card of $$("[data-tilt]", root)) {
    const rx = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3.out" });
    const ry = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3.out" });
    gsap.set(card, { transformPerspective: 900 });
    const move = (event: PointerEvent): void => {
      const r = card.getBoundingClientRect();
      ry(((event.clientX - r.left) / r.width - 0.5) * 14);
      rx(-((event.clientY - r.top) / r.height - 0.5) * 12);
    };
    const leave = (): void => {
      rx(0);
      ry(0);
    };
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerleave", leave);
    ctx.add(() => () => {
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerleave", leave);
    });
  }
}

function isHTMLElement(value: Element): value is HTMLElement {
  return value instanceof HTMLElement;
}
