import { gsap } from "gsap";
import type { ScrollTrigger } from "gsap/ScrollTrigger";
import type { SplitText } from "gsap/SplitText";

/**
 * GSAP for the public site. The core loads with the page (menu, lightbox, cover cursor); the
 * scroll plugins — ScrollTrigger and SplitText, only the scroll scenes use them — are loaded
 * after mount by loadScrollTrigger() and registered then. The scene scheduler awaits it before
 * setting up any scene, so scene code can use scrollTrigger() / splitText(). Imported only by
 * client components; registration is idempotent.
 */

export type ScrollTriggerPlugin = typeof ScrollTrigger;
export type SplitTextPlugin = typeof SplitText;

type ScrollPlugins = { ScrollTrigger: ScrollTriggerPlugin; SplitText: SplitTextPlugin };

let plugins: ScrollPlugins | null = null;
let loading: Promise<ScrollTriggerPlugin> | null = null;

/** Imports and registers ScrollTrigger + SplitText once (a failed import can be retried). */
export function loadScrollTrigger(): Promise<ScrollTriggerPlugin> {
  loading ??= Promise.all([import("gsap/ScrollTrigger"), import("gsap/SplitText")]).then(
    ([scroll, split]) => {
      gsap.registerPlugin(scroll.ScrollTrigger, split.SplitText);
      plugins = { ScrollTrigger: scroll.ScrollTrigger, SplitText: split.SplitText };
      return scroll.ScrollTrigger;
    },
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

/** ScrollTrigger once loaded, else null. */
export function loadedScrollTrigger(): ScrollTriggerPlugin | null {
  return plugins?.ScrollTrigger ?? null;
}

function loaded(): ScrollPlugins {
  if (!plugins) throw new Error("A scroll plugin is used before loadScrollTrigger() resolved");
  return plugins;
}

/** ScrollTrigger inside scene setups (they run after loadScrollTrigger() resolved). */
export function scrollTrigger(): ScrollTriggerPlugin {
  return loaded().ScrollTrigger;
}

/** SplitText inside scene setups (loaded together with ScrollTrigger). */
export function splitText(): SplitTextPlugin {
  return loaded().SplitText;
}

export { gsap };
