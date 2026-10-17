import { fragmentId } from "../locale-switch";
import { SCENE_PENDING_ATTR } from "./env";
import { loadScrollTrigger } from "./gsap";

/**
 * Lazy set-up of the scroll scenes (client only).
 *
 * Setting a scene up (split titles, start states, ScrollTriggers) is real main-thread work, and
 * the landing has a dozen of them. Instead of doing all of it at hydration:
 *  - scenes on screen at start (or holding the #fragment target, or already scrolled past
 *    after a deep link) are set up first, right away;
 *  - every other scene when it comes within 1.5 viewports below the screen (IntersectionObserver,
 *    rootMargin "0px 0px 150% 0px"; never earlier, no idle pre-set-up);
 *  - one scene per task (scheduler.yield / a macrotask in between), so input is never blocked
 *    for long, after the fonts its titles are measured in (≤ 1.8 s);
 *  - only once ScrollTrigger has been loaded (gsap.ts loadScrollTrigger — it is not part of the
 *    page's first JS; requested with the first registration, at hydration). Should it fail to
 *    load, or take longer than PLUGINS_TIMEOUT_MS, every scene is shown as server-rendered.
 * Until its setup ran, a scene root keeps SCENE_PENDING_ATTR, under which CSS draws the start
 * states (noir.css). The boot failsafe (MOTION_BOOT, 4 s after `load`) stays armed until the
 * plugins are in: only then can the scenes take over their start states.
 */

type Job = {
  root: HTMLElement;
  /** Waits for what the setup measures (fonts). */
  prepare: () => Promise<void>;
  run: () => void;
  done: boolean;
};

/** How far below the screen a scene is set up ahead of time. */
const AHEAD = "0px 0px 150% 0px";
/** The longest a scene waits for its fonts before it is set up anyway. */
const FONTS_TIMEOUT_MS = 1800;
/** The longest the scenes wait for the scroll plugins (a stalled request) before they are shown as server-rendered. */
const PLUGINS_TIMEOUT_MS = 6000;

/** On screen / holding the target: set up before everything else, in document order. */
const urgent: Job[] = [];
const queue: Job[] = [];
const watched = new Map<Element, Job>();
let observer: IntersectionObserver | null = null;
let pumping = false;
let started = false;
/** The scroll plugins did not arrive (in time): scenes are shown as server-rendered from now on. */
let failed = false;

/** Lets the browser handle input / paint between two scene setups. */
function yieldToMain(): Promise<void> {
  const scheduler: unknown = Reflect.get(globalThis, "scheduler");
  if (typeof scheduler === "object" && scheduler !== null) {
    const fn: unknown = Reflect.get(scheduler, "yield");
    if (typeof fn === "function") {
      const yielded: unknown = fn.call(scheduler);
      return Promise.resolve(yielded).then(() => undefined);
    }
  }
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(null);
  });
}

/** The app runs: the boot failsafe (MOTION_BOOT, 4 s after `load`) must not fire. */
function appRuns(): void {
  if (window.__gadyukaApp) return;
  window.__gadyukaApp = true;
  window.clearTimeout(window.__gadyukaPending);
}

/** Resolves true once the scroll plugins are registered, false if they failed or did not arrive within PLUGINS_TIMEOUT_MS. */
function scrollPluginsReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      console.error(`Scroll plugins not loaded within ${PLUGINS_TIMEOUT_MS} ms: scenes shown without animation`);
      resolve(false);
    }, PLUGINS_TIMEOUT_MS);
    loadScrollTrigger().then(
      () => {
        window.clearTimeout(timer);
        resolve(true);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        console.error(error);
        resolve(false);
      },
    );
  });
}

/** ScrollTrigger could not be loaded: no scene can run — show them all as server-rendered. */
function giveUp(): void {
  failed = true;
  for (const job of [...urgent, ...queue, ...watched.values()]) {
    job.done = true;
    markSceneReady(job.root);
  }
  urgent.length = 0;
  queue.length = 0;
  watched.clear();
  observer?.disconnect();
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    if (!(await scrollPluginsReady())) {
      giveUp();
      return;
    }
    appRuns();
    for (let job = urgent.shift() ?? queue.shift(); job; job = urgent.shift() ?? queue.shift()) {
      if (job.done) continue;
      await job.prepare();
      if (job.done) continue;
      job.done = true;
      job.run();
      await yieldToMain();
    }
  } finally {
    pumping = false;
  }
}

function enqueue(job: Job, first: boolean): void {
  (first ? urgent : queue).push(job);
  void pump();
}

/** The scene holds the #fragment target (deep links: /#contacts, /catalog/…#product-…). */
function holdsTarget(root: Element): boolean {
  const id = fragmentId(window.location.hash);
  const target = id ? document.getElementById(id) : null;
  return Boolean(target && root.contains(target));
}

function onIntersect(entries: IntersectionObserverEntry[]): void {
  const viewport = window.innerHeight;
  for (const entry of entries) {
    const job = watched.get(entry.target);
    if (!job) continue;
    const { top, bottom } = entry.boundingClientRect;
    const onScreen = top < viewport && bottom > 0;
    const above = bottom <= 0;
    // Scrolled past (a deep link further down): set up too, so the content is final when the
    // visitor scrolls back up — as the old eager setup left it.
    if (!entry.isIntersecting && !above) continue;
    watched.delete(entry.target);
    observer?.unobserve(entry.target);
    enqueue(job, onScreen || holdsTarget(job.root));
  }
}

/** Fonts the scene's split titles are measured in (Tektur display weights), at most FONTS_TIMEOUT_MS. */
export function titleFonts(root: ParentNode): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return Promise.resolve();
  const titles = Array.from(root.querySelectorAll<HTMLElement>(".chapter__title, .gazette__title"));
  if (titles.length === 0) return Promise.resolve();
  const loads = titles.map((title) => {
    const style = getComputedStyle(title);
    return document.fonts.load(`${style.fontStyle} ${style.fontWeight} 16px ${style.fontFamily}`, title.textContent || "А").catch(() => []);
  });
  return Promise.race([Promise.all(loads).then(() => undefined), new Promise<void>((resolve) => window.setTimeout(resolve, FONTS_TIMEOUT_MS))]);
}

/**
 * Registers a scene; `run` is called once, in its own task, when the scene's turn comes.
 * Returns the cancel function (unmount): a scene not set up yet is dropped from the queue.
 */
export function scheduleScene(root: HTMLElement, run: () => void): () => void {
  if (failed) {
    markSceneReady(root);
    return () => undefined;
  }
  if (!started) {
    started = true;
    // Requested at once (hydration), not when the first scene's turn comes. Errors are
    // handled where it is awaited (pump), a failed import is retried there.
    loadScrollTrigger().catch(() => undefined);
  }
  const job: Job = { root, prepare: () => titleFonts(root), run, done: false };
  if (typeof IntersectionObserver === "undefined") {
    enqueue(job, false);
  } else {
    observer ??= new IntersectionObserver(onIntersect, { rootMargin: AHEAD });
    watched.set(root, job);
    observer.observe(root);
  }
  return () => {
    job.done = true;
    if (watched.delete(root)) observer?.unobserve(root);
  };
}

/** The scene is set up (or failed / unmounted): CSS stops drawing its start states. */
export function markSceneReady(root: Element): void {
  root.removeAttribute(SCENE_PENDING_ATTR);
}

declare global {
  interface Window {
    /** Set once the scroll scenes can run — the scroll plugins are in (the boot failsafe then stays off). */
    __gadyukaApp?: boolean;
  }
}
