/**
 * Inline scripts that run before first paint (rendered with dangerouslySetInnerHTML).
 *
 * MOTION_BOOT (in <head> of every public page): adds `html.motion` unless the visitor prefers
 * reduced motion. Only this JS-added class enables hide-before-animate styles, so without JS
 * the page is fully visible. It also adds `html.motion-pending` (the scroll scenes' start states,
 * drawn by CSS on scene roots not set up yet — env.ts PENDING_CLASS). Its failsafe removes the
 * class 4 s after `load` unless the scenes can run by then (scheduler.ts sets
 * window.__gadyukaApp once the scroll plugins are in), so it only matters when the bundle or the
 * plugins do not arrive — scenes set up lazily are not cut short.
 *
 * Before that it opens the near-viewport gate (NEAR_GATE below, production builds only).
 *
 * INTRO_BOOT (first element of the landing <body>): adds `html.is-intro`, under which the cover's
 * intro runs in CSS from the very first paint (noir.css, «COVER INTRO»; backwards-filled
 * keyframes only, so every layer ends in its server-rendered state even if no script ever runs).
 * The hero scene removes the class once the intro animations have finished.
 */

/**
 * Gated by NEAR_GATE, with how far ahead of the viewport each opens: the landing chapters
 * (content-visibility: auto) 1.5 screens ahead, like their scenes (scheduler.ts); the footer
 * only half a screen ahead — it holds nothing but its line of lettering, and on a short page (a
 * collection on a phone) 1.5 screens would fetch the lettering face with the first screen.
 */
const NEAR_TARGETS: ReadonlyArray<readonly [selector: string, rootMargin: string]> = [
  ["main > section.page[id]", "150% 0px"],
  [".ftr", "50% 0px"],
];
/** Hand-lettered text (noir.css `--f-letter`) whose face NEAR_GATE requests ahead of its layout. */
const LETTER_TEXT = ".say__bubble p, .ftr__tbc";
/** The hand-lettering face (next/font `Shantell_Sans`, weight 700 — src/app/[locale]/layout.tsx). */
const LETTER_FONT = '700 1em "Shantell Sans"';
/** noir.css «near-viewport gate»: set on a gated element once it comes near (NEAR_TARGETS). */
const NEAR_ATTR = "data-near";
/** noir.css «near-viewport gate»: on <html> while the gate is closed for elements without NEAR_ATTR. */
export const NEAR_GATE_CLASS = "near-gate";

/**
 * Near-viewport gate (production): under `html.near-gate`, noir.css holds back what a landing
 * chapter or the footer would download for itself — brand art drawn as CSS masks / backgrounds,
 * the hand-lettering face — until it comes near the viewport (NEAR_TARGETS): an
 * IntersectionObserver (from DOMContentLoaded) sets [data-near], and the face is then requested
 * at once, ahead of the text's layout. Below-the-fold chapters are skipped by content-visibility
 * anyway, but a browser may still lay them out early (Chrome builds an annotated page-content
 * tree about 1 s after load; the chapters' height learning; the footer is not skipped at all)
 * and would fetch all of it then. No JS — no gate. Development builds leave it off: the attribute, set before
 * hydration, would show up in React's hydration diff there. Elements the client renders later
 * (the page put back by the error boundary's retry: new top-level nodes of <body>) are picked up
 * by a MutationObserver on <body>'s children. The public pages link to each other with plain <a>
 * (every page is a document load) — a client-side navigation (next/link) that swaps the page
 * below <body>'s children would need to lift the gate.
 */
const NEAR_GATE =
  process.env.NODE_ENV === "production"
    ? `if(window.IntersectionObserver){d.classList.add('${NEAR_GATE_CLASS}');document.addEventListener('DOMContentLoaded',function(){var f=[];function w(s,m){var o=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;var t=e.target,l=t.querySelector('${LETTER_TEXT}');o.unobserve(t);t.setAttribute('${NEAR_ATTR}','');if(l&&document.fonts)document.fonts.load('${LETTER_FONT}',l.textContent||'А').catch(function(){})})},{rootMargin:m});function a(){document.querySelectorAll(s).forEach(function(t){if(!t.hasAttribute('${NEAR_ATTR}'))o.observe(t)})}a();f.push(a)}${NEAR_TARGETS.map(([selector, margin]) => `w('${selector}','${margin}');`).join("")}if(window.MutationObserver)new MutationObserver(function(){f.forEach(function(a){a()})}).observe(document.body,{childList:true})})}`
    : "";

export const MOTION_BOOT = `(function(){try{var d=document.documentElement;${NEAR_GATE}if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;d.classList.add('motion','motion-pending');window.addEventListener('load',function(){if(!window.__gadyukaApp)window.__gadyukaPending=window.setTimeout(function(){d.classList.remove('motion-pending')},4000)})}catch(e){}})();`;

/**
 * Skipped when the page opens at a section (`/#contacts`, `/?topic=…#lead-form`, `/en#reviews`
 * after a language switch): the cover is not on screen there. HeroScene then takes the
 * no-intro path (the cover is simply there, its loops start at once).
 */
export const INTRO_BOOT = `(function(){var d=document.documentElement,h=location.hash;if(!d.classList.contains('motion')||(h.length>1&&h!=='#home'&&h!=='#main'))return;d.classList.add('is-intro')})();`;

declare global {
  interface Window {
    /** Failsafe timer of MOTION_BOOT's `motion-pending` (cleared once the scroll plugins are in — scheduler.ts). */
    __gadyukaPending?: number;
  }
}
