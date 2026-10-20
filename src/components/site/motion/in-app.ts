/**
 * In-app browsers — the WebViews Telegram, Instagram, VK, Facebook, OK … open links in.
 *
 * They get two things normal browsers do not (motion/boot.ts MOTION_BOOT, before first paint):
 *  - IN_APP_CLASS — and, like every touch screen (HERO_PX_CLASS below), a cover height in px;
 *  - LITE_CLASS instead of the scroll scenes (unless reduced motion turns motion off anyway): a
 *    WebView's main thread is weaker (and its compositor tied to the app's), and the GSAP scroll
 *    reveals kept it busy on every frame of a swipe. The page is drawn in its final state; the
 *    cover intro and the CSS loops (rain, ticker, tape, red band, tongue flicks) stay, and a few
 *    scroll effects are redone cheaply (motion/lite.ts, noir.css «LITE MOTION»).
 *
 * Detection is by user agent, conservatively — only in-app browsers, never a regular one:
 *  - Android: every app embeds the system WebView, whose UA carries "; wv)"; the apps' own tokens
 *    are listed too (some strip "wv");
 *  - iOS: a WKWebView is an iPhone / iPad WebKit without the "Safari/" token (Safari, Chrome,
 *    Firefox, Edge on iOS all carry it; iPadOS Safari even poses as a Mac). The site added to
 *    the home screen (app/manifest.ts: display "standalone"; iOS 26 opens it as a web app by
 *    default) has that UA too, but it is Safari's engine in a window of its own and gets the
 *    full site: it is told apart by navigator.standalone / the display-mode media query.
 */

export const IN_APP_CLASS = 'in-app';
/**
 * On <html> of touch screens and in-app browsers: the cover's height is --hero-h, in px
 * (noir.css), not 100svh. A WebView's svh is the WebView's own height, and the host app resizes
 * the WebView itself — a menu that collapses while the page scrolls (Telegram, Instagram, VK…),
 * a bottom sheet that expands, the keyboard; Chrome on Android resizes the page for the keyboard
 * too. 100svh would follow every such resize: the cover would grow / shrink, and everything below
 * it jump on screen, mid-swipe — scroll anchoring does not make up for a change of the viewport
 * (measured in an emulator WebView with a collapsing bottom menu: the visible content jumped by
 * the menu's height at each toggle; with the cover in px, not once). Many in-app browsers cannot
 * be told by their user agent (Telegram's poses as Chrome), so it is every touch screen: there the
 * px height is the viewport's at load — what 100svh is in a browser with collapsing toolbars —
 * taken again only when the width changes (rotation) or at the top of the page.
 */
export const HERO_PX_CLASS = 'hero-px';
/** Not a touch screen (a mouse or trackpad drives it): the cover stays 100svh, a window resize resizes it. */
export const FINE_HOVER_QUERY = '(hover: hover) and (pointer: fine)';
/** On <html> with `motion` in an in-app browser: no scroll scenes (env.ts liteMotion()). */
export const LITE_CLASS = 'motion-lite';

/** Android WebView token and the in-app browsers' own tokens. */
export const IN_APP_UA = /; wv\)|Telegram|Instagram|FBA[NV]\/|VKAndroidApp|VKClient|OKApp/i;
/** An iOS WebKit that is not a browser (no "Safari/" token): a WKWebView inside an app — or the home-screen web app. */
export const IOS_WEBVIEW_UA = /(iPhone|iPad|iPod).*AppleWebKit(?!.*Safari\/)/;
/** The site opened from the home screen (manifest display "standalone"). */
export const STANDALONE_QUERY = '(display-mode: standalone)';

/**
 * The same test as MOTION_BOOT (boot.ts) runs before first paint. `standalone`: the page runs as
 * an installed web app (iOS navigator.standalone, or STANDALONE_QUERY matches).
 */
export function isInAppBrowser(userAgent: string, standalone = false): boolean {
  return IN_APP_UA.test(userAgent) || (IOS_WEBVIEW_UA.test(userAgent) && !standalone);
}
