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
 * In an in-app browser (in-app.ts) it adds `html.motion-lite` instead of `motion-pending` (no
 * scroll scenes: their start states must not be drawn) and, with or without motion, `html.in-app`;
 * there and on every touch screen, the cover's height in px (IN_APP_HERO below).
 *
 * Before that it opens the near-viewport gate (NEAR_GATE below, production builds only), and
 * first of all — reduced motion or not — it installs the tap guard (TAP_GUARD below: no click
 * from a touch that was a swipe) and adds `html.snake-bar` (chrome/snake-bar.ts): the
 * scroll snake (chrome/ScrollSpine) is the page's scrollbar and noir.css hides the native one.
 * Its failsafe (SCROLLBAR_FAILSAFE below) gives the native scrollbar back when the snake's
 * script has not run 4 s after `load`.
 *
 * INTRO_BOOT (first element of the landing <body>): adds `html.is-intro`, under which the cover's
 * intro runs in CSS from the very first paint (noir.css, «COVER INTRO»; backwards-filled
 * keyframes only, so every layer ends in its server-rendered state even if no script ever runs).
 * The hero scene removes the class once the intro animations have finished.
 */

import { SCROLLBAR_CLASS, SCROLLBAR_FAILSAFE_MS, SCROLLBAR_READY_CLASS, SNAKE_OFF_CLASS } from '../chrome/snake-bar';
import {
  FINE_HOVER_QUERY,
  HERO_PX_CLASS,
  IN_APP_CLASS,
  IN_APP_UA,
  IOS_WEBVIEW_UA,
  LITE_CLASS,
  STANDALONE_QUERY,
} from './in-app';
import { SCENE_LATE_ATTR, SCENE_PENDING_ATTR } from './scene-attrs';
import {
  TAP_AFTER_END_MS,
  TAP_MOVE_MIN_PX,
  TAP_MOVING_MS,
  TAP_SLOP_PX,
  TAP_STALL_MARGIN_MS,
  TAP_STALL_MS,
  TAP_TRAVEL_PX,
} from './tap-guard';

/**
 * Gated by NEAR_GATE, with how far ahead of the viewport each opens: the landing chapters
 * (content-visibility: auto) 1.5 screens ahead, like their scenes (scheduler.ts); the footer
 * only half a screen ahead — it holds nothing but its line of lettering, and on a short page (a
 * collection on a phone) 1.5 screens would fetch the lettering face with the first screen.
 */
const NEAR_TARGETS: ReadonlyArray<readonly [selector: string, rootMargin: string]> = [
  ['main > section.page[id]', '150% 0px'],
  ['.ftr', '50% 0px'],
];
/** Hand-lettered text (noir.css `--f-letter`) whose face NEAR_GATE requests ahead of its layout. */
const LETTER_TEXT = '.say__bubble p, .ftr__tbc';
/** The hand-lettering face (next/font `Shantell_Sans`, weight 700 — src/app/[locale]/layout.tsx). */
const LETTER_FONT = '700 1em "Shantell Sans"';
/** noir.css «near-viewport gate»: set on a gated element once it comes near (NEAR_TARGETS). */
const NEAR_ATTR = 'data-near';
/** noir.css «near-viewport gate»: on <html> while the gate is closed for elements without NEAR_ATTR. */
export const NEAR_GATE_CLASS = 'near-gate';

/**
 * Near-viewport gate (production): under `html.near-gate`, noir.css holds back what a landing
 * chapter or the footer would download for itself — brand art drawn as CSS masks / backgrounds,
 * the hand-lettering face — until it comes near the viewport (NEAR_TARGETS): an
 * IntersectionObserver (from DOMContentLoaded) sets [data-near], and the face is then requested
 * at once, ahead of the text's layout. Below-the-fold chapters are skipped by content-visibility
 * anyway, but a browser may still lay them out early (Chrome builds an annotated page-content
 * tree about 1 s after load; the footer is not skipped at all) and would fetch all of it then.
 * No JS — no gate. Development builds leave it off: the attribute, set before hydration, would
 * show up in React's hydration diff there. Elements the client renders later
 * (the page put back by the error boundary's retry: new top-level nodes of <body>) are picked up
 * by a MutationObserver on <body>'s children. The public pages link to each other with plain <a>
 * (every page is a document load) — a client-side navigation (next/link) that swaps the page
 * below <body>'s children would need to lift the gate.
 */
const NEAR_GATE =
  process.env.NODE_ENV === 'production'
    ? `if(window.IntersectionObserver){d.classList.add('${NEAR_GATE_CLASS}');document.addEventListener('DOMContentLoaded',function(){var f=[];function w(s,m){var o=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;var t=e.target,l=t.querySelector('${LETTER_TEXT}');o.unobserve(t);t.setAttribute('${NEAR_ATTR}','');if(l&&document.fonts)document.fonts.load('${LETTER_FONT}',l.textContent||'А').catch(function(){})})},{rootMargin:m});function a(){document.querySelectorAll(s).forEach(function(t){if(!t.hasAttribute('${NEAR_ATTR}'))o.observe(t)})}a();f.push(a)}${NEAR_TARGETS.map(([selector, margin]) => `w('${selector}','${margin}');`).join('')}if(window.MutationObserver)new MutationObserver(function(){f.forEach(function(a){a()})}).observe(document.body,{childList:true})})}`
    : '';

/**
 * In-app browsers (`ia`): `html.in-app`. They and every touch screen (no fine hovering pointer):
 * `html.hero-px` and --hero-h, the cover's height (noir.css, in-app.ts HERO_PX_CLASS) — the
 * viewport height in px, taken again only when the width changes (rotation) or at the top of the
 * page (on a resize or on scrolling back up there). The host app resizes a WebView mid-swipe (a
 * menu collapsing, Telegram's bottom sheet expanding, the keyboard) and 100svh would follow it:
 * the cover would change height and everything below it jump. A height under 200 px (a WebView
 * not laid out yet) is not taken.
 */
const IN_APP_HERO = `if(ia)d.classList.add('${IN_APP_CLASS}');if(ia||!window.matchMedia('${FINE_HOVER_QUERY}').matches){d.classList.add('${HERO_PX_CLASS}');var W=0,H=0,L=function(f){var h=innerHeight,c=innerWidth!=W;W=innerWidth;if(h>199&&h!=H&&(f||c||!H||scrollY<1)){H=h;d.style.setProperty('--hero-h',h+'px')}};L(1);addEventListener('resize',function(){L()});addEventListener('scroll',function(){scrollY<1&&L()},{passive:true})}`;

/**
 * In-app browser (in-app.ts isInAppBrowser): an iOS WebKit without "Safari/" is a WKWebView
 * unless it runs as the home-screen web app (navigator.standalone, or the display mode).
 */
const IN_APP_TEST = `${IN_APP_UA}.test(u)||(${IOS_WEBVIEW_UA}.test(u)&&!navigator.standalone&&!window.matchMedia('${STANDALONE_QUERY}').matches)`;

/**
 * The native scrollbar is hidden from the first paint (`html.snake-bar`), the snake's progress is
 * drawn by CSS where the browser has scroll timelines — but dragging it, and its progress
 * elsewhere, need the app bundle. Should it never run (blocked, failed to load), the page is not
 * left without a scrollbar: 4 s after `load` without `html.snake-ready` (set by ScrollSpine) the
 * class goes and the native scrollbar is back (ScrollSpine puts it on again if it mounts later).
 */
const SCROLLBAR_FAILSAFE = `if(!snakeOff){d.classList.add('${SCROLLBAR_CLASS}');window.addEventListener('load',function(){window.setTimeout(function(){if(!d.classList.contains('${SCROLLBAR_READY_CLASS}'))d.classList.remove('${SCROLLBAR_CLASS}')},${SCROLLBAR_FAILSAFE_MS})})}`;

/**
 * Late gate (production, full motion): until a scroll scene is set up, CSS draws its start
 * states (hidden / clipped content, `motion-pending` + SCENE_PENDING_ATTR). On a cold visit over a
 * slow network the app bundle arrives seconds after the first paint, and a visitor who scrolls
 * meanwhile would pass chapters drawn empty — then see them pop and animate in under the finger
 * (measured on Android Chrome: «the page jumps by blocks»). So, once the visitor has scrolled,
 * a scene root still pending that comes within LATE_AHEAD of the screen gets SCENE_LATE_ATTR:
 * CSS stops drawing its start states (the content shows as rendered) and its setup keeps what
 * may already have been seen as rendered (effects.ts unseen() — what is still below the fold
 * reveals as usual). Details:
 *  - only a scroll after the visitor's own input counts (USER_INPUT): the browser's fragment
 *    scroll (/#contacts), scroll restoration on reload and the app's own alignToHash do not;
 *  - marked ahead of the screen (LATE_AHEAD), not once a root is on it: the IntersectionObserver
 *    reports after a paint, and a busy main thread (the bundle compiling) would otherwise let the
 *    compositor scroll empty start states into view first;
 *  - the roots already near the screen at the first such scroll (no new intersection) are swept
 *    once, reads first, then writes;
 *  - it stops once the first round of scene setups is done (window.__gadyukaSettled, scheduler.ts):
 *    from then on the scheduler sets scenes up ahead of the screen itself.
 * Development builds leave it off (an attribute set before hydration shows up in React's
 * hydration diff there), like NEAR_GATE.
 */
const LATE_AHEAD = '50% 0px';
/** Input that makes a following scroll the visitor's own (as scroll-tween.ts USER_SCROLL_EVENTS). */
const USER_INPUT = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

export function lateGate(enabled: boolean): string {
  if (!enabled) return '';
  const P = SCENE_PENDING_ATTR;
  const L = SCENE_LATE_ATTR;
  return (
    `if(window.IntersectionObserver){var sc=0,ui=0;` +
    `${JSON.stringify(USER_INPUT)}.forEach(function(n){addEventListener(n,function(){ui=1},{passive:true,capture:true,once:true})});` +
    `addEventListener('scroll',function f(){if(ui){sc=1;removeEventListener('scroll',f)}},{passive:true});` +
    `document.addEventListener('DOMContentLoaded',function(){` +
    `var lo=new IntersectionObserver(function(es){if(window.__gadyukaSettled){lo.disconnect();return}if(!sc)return;` +
    `es.forEach(function(e){var t=e.target;if(!t.hasAttribute('${P}')){lo.unobserve(t);return}if(e.isIntersecting){t.setAttribute('${L}','');lo.unobserve(t)}})},{rootMargin:'${LATE_AHEAD}'});` +
    `document.querySelectorAll('[${P}]').forEach(function(t){lo.observe(t)});` +
    `addEventListener('scroll',function g(){if(!sc)return;removeEventListener('scroll',g);if(window.__gadyukaSettled){lo.disconnect();return}` +
    `var h=innerHeight,hit=[];document.querySelectorAll('[${P}]:not([${L}])').forEach(function(t){var r=t.getBoundingClientRect();if(r.top<h*1.5&&r.bottom>-h*.5)hit.push(t)});` +
    `hit.forEach(function(t){t.setAttribute('${L}','');lo.unobserve(t)})},{passive:true})})}`
  );
}

const LATE_GATE = lateGate(process.env.NODE_ENV === 'production');

/**
 * Tap guard (every page, every engine, with or without motion; numbers in tap-guard.ts): the
 * compatibility mousedown and the click of a touch that was a swipe, not a tap, are cancelled
 * before anything sees them (window, capture phase, the first listeners of the page: in-page
 * anchors, SmoothScroll, React, next/link, the native link activation, mouse focus — a form field
 * focused would bring the keyboard up and scroll the page to it — and a <select>'s popup). A swipe:
 *  - the finger landed on a moving page (a root scroll frame of TAP_MOVE_MIN_PX or more within
 *    TAP_MOVING_MS — a fling still running, the visible part of an anchor tween; the window grows
 *    by the delay when the touchstart is handled late, the main thread busy while the compositor
 *    may have kept a fling going), or inside a nested scroller (the mobile menu, a row of collection
 *    covers) that was moving;
 *  - the finger travelled more than TAP_TRAVEL_PX before it lifted;
 *  - the page (or that nested scroller) scrolled more than TAP_SLOP_PX between the finger landing
 *    and lifting (measured at touchend: a field error inserted above by the tap's own blur may
 *    shift the page before the click), or a nested scroller under the finger scrolled meanwhile.
 * Chrome on Android and iOS Safari never turn such a touch into a click; Android WebView — the
 * in-app browsers of Telegram, Instagram, VK, WhatsApp — does: on the emulator 5 of 32 quick
 * flicks chained over a running fling came out as clicks (0 of 32 in Chrome) — some while the page
 * scrolled on under the finger, some as a whole flick taken for a tap (its moves lost) — and an
 * in-page link under the finger then smooth-scrolled the page to its chapter («the page skips ahead
 * when scrolled fast»), a gallery link opened the lightbox, a collection link would open another
 * page. Only events of that touch are judged: within TAP_AFTER_END_MS of its touchend, never a
 * keyboard click (detail 0), a mouse / pen click (pointerType) or a mouse's mousedown
 * (sourceCapabilities) — a touch laptop's trackpad click right after a finger swipe goes through.
 * It also publishes the last moving root scroll frame (`window.__gadyukaScrollAt`: ScrollSpine does
 * not hand the snake's head to a finger the page still moves under), the visitor's first input
 * (`window.__gadyukaInput`, from the first script — SmoothScroll's deep-link alignment stops once
 * the visitor has acted, even before hydration) and the cancelled clicks (`__gadyukaTapsBlocked`,
 * shown by the ?diag=1 overlay).
 */
export const TAP_GUARD =
  `var ls=-1e9,ly=window.scrollY,ns=null,no=0,lns=-1e9,tp=null,pn=function(){return performance.now()};` +
  `${JSON.stringify(USER_INPUT)}.forEach(function(n){addEventListener(n,function(){window.__gadyukaInput=true},{passive:true,capture:true,once:true})});` +
  `addEventListener('scroll',function(e){var x=e.target,t=pn(),o;` +
  `if(x===document||x===d){o=window.scrollY;if(Math.abs(o-ly)>=${TAP_MOVE_MIN_PX}){ls=t;window.__gadyukaScrollAt=t}ly=o}` +
  `else if(x&&x.nodeType===1){o=x.scrollLeft+x.scrollTop;if(x===ns&&Math.abs(o-no)>=${TAP_MOVE_MIN_PX})lns=t;ns=x;no=o}},{passive:true,capture:true});` +
  `addEventListener('touchstart',function(e){var t=pn(),k=t-(e.timeStamp||t),w=${TAP_MOVING_MS}+(k>${TAP_STALL_MS}?k+${TAP_STALL_MARGIN_MS}:0),g=e.target,s=ns&&g&&ns.contains(g)?ns:null,c=e.changedTouches&&e.changedTouches[0],y=window.scrollY,o=s?s.scrollLeft+s.scrollTop:0;` +
  `tp={t:t,e:0,y:y,y2:y,m:t-ls<w||(!!s&&t-lns<w),s:s,o:o,o2:o,i:c?c.identifier:null,x0:c?c.clientX:0,y0:c?c.clientY:0,v:0}},{passive:true,capture:true});` +
  `var tv=function(e,end){var p=tp,l=e.changedTouches||[];if(p)for(var k=0;k<l.length;k++)if(l[k].identifier===p.i){var dx=l[k].clientX-p.x0,dy=l[k].clientY-p.y0;p.v=Math.max(p.v,dx*dx+dy*dy);` +
  `if(end){p.e=pn();p.y2=window.scrollY;p.o2=p.s?p.s.scrollLeft+p.s.scrollTop:0}}};` +
  `addEventListener('touchmove',function(e){tv(e)},{passive:true,capture:true});addEventListener('touchend',function(e){tv(e,1)},{passive:true,capture:true});` +
  `var bad=function(e){var p=tp,g=e.target,c=e.sourceCapabilities;` +
  `if(!p||!e.detail||!p.e||pn()-p.e>${TAP_AFTER_END_MS}||(e.pointerType&&e.pointerType!=='touch')||(c&&c.firesTouchEvents===false))return false;` +
  `return p.m||p.v>${TAP_TRAVEL_PX * TAP_TRAVEL_PX}||Math.abs(p.y2-p.y)>${TAP_SLOP_PX}||(!!p.s&&Math.abs(p.o2-p.o)>${TAP_SLOP_PX})||(!!ns&&lns>p.t&&!!g&&ns.contains(g))};` +
  `addEventListener('mousedown',function(e){if(bad(e)){e.preventDefault();e.stopImmediatePropagation()}},true);` +
  `addEventListener('click',function(e){if(!e.detail||(e.pointerType&&e.pointerType!=='touch'))return;var b=bad(e);tp=null;if(b){e.preventDefault();e.stopImmediatePropagation();window.__gadyukaTapsBlocked=(window.__gadyukaTapsBlocked||0)+1}},true);`;

/**
 * Diagnostics and bisect switches, read from the query string before the first paint — for
 * devices we cannot automate (in-app WebViews on a visitor's phone). Without the parameters
 * nothing changes:
 *  - `?diag=1` loads public/diag/scroll-diag.js, an on-screen overlay of what moves the page;
 *  - `?snake=0` keeps the native scrollbar and leaves the snake out (SNAKE_OFF_CLASS);
 *  - `?lite=0` / `?lite=1` force the full / lite motion regardless of the user agent (LITE_SWITCH);
 *    only the motion — an in-app browser keeps `html.in-app` and its cover height (IN_APP_HERO).
 */
const DIAG = `var q=(window.location&&window.location.search)||'',snakeOff=/[?&]snake=0(&|$)/.test(q);if(snakeOff)d.classList.add('${SNAKE_OFF_CLASS}');if(/[?&]diag=1(&|$)/.test(q)){var sd=document.createElement('script');sd.src='/diag/scroll-diag.js';document.head.appendChild(sd)}`;
const LITE_SWITCH = `var lite=ia;if(/[?&]lite=0(&|$)/.test(q))lite=false;else if(/[?&]lite=1(&|$)/.test(q))lite=true;`;

export const MOTION_BOOT = `(function(){try{var d=document.documentElement;${TAP_GUARD}${DIAG}${SCROLLBAR_FAILSAFE}var u=navigator.userAgent,ia=${IN_APP_TEST};${LITE_SWITCH}${NEAR_GATE}${IN_APP_HERO}if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;if(lite){d.classList.add('motion','${LITE_CLASS}');return}d.classList.add('motion','motion-pending');${LATE_GATE}window.addEventListener('load',function(){if(!window.__gadyukaApp)window.__gadyukaPending=window.setTimeout(function(){d.classList.remove('motion-pending')},4000)})}catch(e){}})();`;

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
