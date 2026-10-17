/**
 * The landing's chapters are content-visibility: auto (noir.css): until a chapter has been
 * rendered once, its height is an estimate (contain-intrinsic-block-size), so the page below it
 * — anchor targets, the scroll range — sits a little off. After `load`, in idle time, each
 * chapter that was never rendered is rendered once (content-visibility: visible), so `auto`
 * remembers its real height: menu jumps and deep links then land exactly, nothing moves when
 * the visitor scrolls back up, and the chapter's first layout (text shaping, the costly part on
 * a slow phone) is not paid in the middle of a scroll.
 *
 * A chapter is laid out block by block (its .wrap children, one per idle callback), so no single
 * step is a long task, and with data-warming on it — under which noir.css drops its CSS images
 * (brand masks, figures): they are still fetched only when the chapter nears the screen. The
 * blocks not laid out yet are held with content-visibility: auto — skipped that far from the
 * screen, yet still in the accessibility tree, focusable and found by find-in-page. A partly
 * laid-out chapter must not become the remembered height, so the chapter remembers nothing
 * (contain-intrinsic-block-size: none) until its last block is in. Should the chapter come near
 * the screen meanwhile (the visitor scrolls towards it), the warm-up is dropped — the chapter is
 * `auto` again, and the browser renders it as it would have without warming — and retried
 * later. No warm-up starts while the visitor is scrolling.
 *
 * Only where noir.css makes the chapters content-visibility: auto (engines with scroll
 * anchoring, see there).
 */

/** The chapters with content-visibility: auto. */
export const CHAPTER_SELECTOR = "main > section.page[id]";

const STYLE = "content-visibility";
const REMEMBER = "contain-intrinsic-block-size";
/** noir.css: no CSS images inside a chapter while it is rendered off screen for its size. */
const WARMING_ATTR = "data-warming";
/** Idle callbacks run at the latest after this long. */
const IDLE_TIMEOUT_MS = 4000;
/** Without requestIdleCallback: the pause before each step. */
const FALLBACK_IDLE_MS = 120;
/** No new chapter is warmed up until the page has not been scrolled for this long. */
const QUIET_MS = 600;

/** Runs `fn` at the next idle moment; returns the cancel function. */
function onIdle(fn: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(() => fn(), { timeout: IDLE_TIMEOUT_MS });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, FALLBACK_IDLE_MS);
  return () => window.clearTimeout(id);
}

/** The chapter reaches to less than `above` screens above / `below` screens below the viewport. */
function isNear(chapter: Element, above: number, below: number): boolean {
  const { top, bottom } = chapter.getBoundingClientRect();
  return top < window.innerHeight * below && bottom > -window.innerHeight * above;
}

/** Starts learning the chapters' heights after `load`; returns the cancel function. */
export function learnChapterSizes(): () => void {
  const chapters = Array.from(document.querySelectorAll<HTMLElement>(CHAPTER_SELECTOR));
  if (chapters.length === 0 || !CSS.supports("content-visibility", "auto") || !CSS.supports("overflow-anchor", "auto")) {
    return () => undefined;
  }

  // Chapters rendered at least once already know their height.
  const rendered = new WeakSet<Element>();
  const onState = (event: Event): void => {
    const target = event.target;
    if (Reflect.get(event, "skipped") === false && target instanceof Element) rendered.add(target);
  };
  chapters.forEach((chapter) => chapter.addEventListener("contentvisibilityautostatechange", onState));

  const queue = [...chapters];
  let cancelled = false;
  let lastScroll = Number.NEGATIVE_INFINITY;
  /** Cancels the one callback waiting at any time (frame, idle moment or quiet timer). */
  let cancelPending = (): void => undefined;
  /** The chapter being warmed up and its blocks still held back. */
  let current: { chapter: HTMLElement; held: HTMLElement[] } | null = null;

  /** Waits for a rendered frame (its sizes are remembered then), then the next idle moment. */
  const afterFrame = (then: () => void): void => {
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        cancelPending = onIdle(then);
      });
    });
    cancelPending = () => window.cancelAnimationFrame(frame);
  };

  /** Runs `then` in an idle moment at least QUIET_MS after the last scroll. */
  const whenQuiet = (then: () => void): void => {
    const wait = lastScroll + QUIET_MS - performance.now();
    if (wait <= 0) {
      then();
      return;
    }
    const timer = window.setTimeout(() => {
      cancelPending = onIdle(() => whenQuiet(then));
    }, wait);
    cancelPending = () => window.clearTimeout(timer);
  };

  /** Puts the current chapter back as it was (`auto`, nothing held, images allowed). */
  const restore = (): HTMLElement | null => {
    if (!current) return null;
    const { chapter, held } = current;
    current = null;
    held.forEach((block) => block.style.removeProperty(STYLE));
    chapter.style.removeProperty(STYLE);
    chapter.style.removeProperty(REMEMBER);
    chapter.removeAttribute(WARMING_ATTR);
    return chapter;
  };

  /** The chapter being warmed up comes near the screen: drop the warm-up, retry it later. */
  const abort = (): void => {
    cancelPending();
    const chapter = restore();
    if (chapter && !rendered.has(chapter)) queue.unshift(chapter);
    cancelPending = onIdle(step);
  };

  const onScroll = (): void => {
    lastScroll = performance.now();
    // Scroll anchoring also scrolls while a chapter above the screen changes height; only a
    // chapter about to be rendered by the browser ends its warm-up.
    if (current && isNear(current.chapter, 1, 2)) abort();
  };

  const finishChapter = (): void => {
    if (!current) return;
    const { chapter } = current;
    // Back to `auto` (skipped again off screen) first; its images come back a frame later,
    // when the chapter's style is no longer computed — they load when it nears the screen.
    chapter.style.removeProperty(STYLE);
    rendered.add(chapter);
    afterFrame(() => {
      chapter.removeAttribute(WARMING_ATTR);
      current = null;
      step();
    });
  };

  const revealNext = (): void => {
    if (!current || cancelled) return;
    const block = current.held.shift();
    if (!block) {
      // Every block was laid out in the frames so far: one rendered frame with `auto` lets the
      // chapter remember its full height, then it is skipped again.
      current.chapter.style.removeProperty(REMEMBER);
      afterFrame(finishChapter);
      return;
    }
    block.style.removeProperty(STYLE);
    afterFrame(revealNext);
  };

  const step = (): void => {
    if (cancelled) return;
    if (performance.now() - lastScroll < QUIET_MS) {
      whenQuiet(step);
      return;
    }
    let chapter = queue.shift();
    while (chapter && rendered.has(chapter)) chapter = queue.shift();
    if (!chapter) {
      window.removeEventListener("scroll", onScroll);
      return;
    }
    // Near the screen it is (or is about to be) rendered by the browser anyway.
    if (isNear(chapter, 1, 2)) {
      rendered.add(chapter);
      step();
      return;
    }
    const held = Array.from(chapter.querySelectorAll<HTMLElement>(":scope > .wrap > *"));
    held.forEach((block) => block.style.setProperty(STYLE, "auto"));
    chapter.setAttribute(WARMING_ATTR, "");
    chapter.style.setProperty(STYLE, "visible");
    chapter.style.setProperty(REMEMBER, "none");
    current = { chapter, held };
    afterFrame(revealNext);
  };

  const start = (): void => {
    window.addEventListener("scroll", onScroll, { passive: true });
    cancelPending = onIdle(step);
  };

  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });

  return () => {
    cancelled = true;
    cancelPending();
    restore();
    window.removeEventListener("load", start);
    window.removeEventListener("scroll", onScroll);
    chapters.forEach((chapter) => {
      chapter.removeEventListener("contentvisibilityautostatechange", onState);
      chapter.style.removeProperty(STYLE);
      chapter.style.removeProperty(REMEMBER);
      chapter.removeAttribute(WARMING_ATTR);
    });
  };
}
