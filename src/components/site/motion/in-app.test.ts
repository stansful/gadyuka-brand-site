import { describe, expect, it } from 'vitest';

import { SCROLLBAR_CLASS, SCROLLBAR_FAILSAFE_MS, SCROLLBAR_READY_CLASS, SNAKE_OFF_CLASS } from '../chrome/snake-bar';
import { MOTION_BOOT } from './boot';
import { FINE_HOVER_QUERY, HERO_PX_CLASS, IN_APP_CLASS, isInAppBrowser, LITE_CLASS } from './in-app';

/** In-app browsers (WebViews) the landing is opened in from messengers and social apps. */
const IN_APP = {
  telegramAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-A525F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Telegram-Android/11.2.3 (Samsung SM-A525F; Android 13; SDK 33; HIGH)',
  instagramAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.6533.103 Mobile Safari/537.36 Instagram 343.0.0.33.101 Android (34/14; 420dpi; 1080x2205; Google/google; Pixel 8; shiba; shiba; en_US; 628139364)',
  vkAndroid:
    'Mozilla/5.0 (Linux; Android 12; Redmi Note 10 Pro Build/SKQ1.210908.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.134 Mobile Safari/537.36 VKAndroidApp/8.95-19020 (Android 12; SDK 31; arm64-v8a; Xiaomi Redmi Note 10 Pro; ru; 2400x1080)',
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 341.0.0.36.98 (iPhone15,2; iOS 17_5; ru_RU; ru; scale=3.00; 1179x2556; 627400398)',
  facebookIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/459.0.0.40.109;FBBV/600000000;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.4;FBSS/3;FBCR/;FBID/phone;FBLC/ru_RU;FBOP/80]',
  iosWebView:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
};

/** The site added to the iOS home screen (manifest display "standalone"): a WebKit UA without "Safari/", like a WKWebView. */
const HOME_SCREEN_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

/** Regular browsers: never lite (full motion, the cover keeps 100svh). */
const BROWSERS = {
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-A525F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.100 Mobile Safari/537.36',
  lighthouseMobile:
    'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36',
  yandexAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-A525F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 YaBrowser/24.7.4.98.00 SA/3 Mobile Safari/537.36',
  safariIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  chromeIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  safariIpad:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  chromeDesktop:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};

describe('in-app browser detection', () => {
  it.each(Object.entries(IN_APP))('%s is an in-app browser', (_name, userAgent) => {
    expect(isInAppBrowser(userAgent)).toBe(true);
  });

  it.each(Object.entries(BROWSERS))('%s is a regular browser', (_name, userAgent) => {
    expect(isInAppBrowser(userAgent)).toBe(false);
  });

  it('the site opened from the iOS home screen (same UA as a WKWebView) is not an in-app browser', () => {
    expect(isInAppBrowser(HOME_SCREEN_IOS)).toBe(true);
    expect(isInAppBrowser(HOME_SCREEN_IOS, true)).toBe(false);
    // an app's own token still wins
    expect(isInAppBrowser(IN_APP.instagramIos, true)).toBe(true);
  });
});

type Viewport = { innerWidth: number; innerHeight: number; scrollY: number };
type Page = { classes: string[]; heroHeight: string | undefined };
/** The page around the script: what the app bundle would do to <html>, and the clock. */
type BootPage = {
  addClass: (name: string) => void;
  /** Runs the timers the script has set so far, and returns how long each was set for (ms). */
  runTimers: () => number[];
};

/**
 * Runs MOTION_BOOT against a minimal browser-like global (the script reads the viewport through
 * bare globals, as in a browser); `then` may change the viewport and fire the window events the
 * script listens to while those globals are in place.
 */
function runBoot(
  userAgent: string,
  {
    reducedMotion = false,
    standalone,
    displayStandalone = false,
    search = '',
    finePointer = false,
    then,
  }: {
    reducedMotion?: boolean;
    /** A mouse / trackpad drives it (FINE_HOVER_QUERY matches): a desktop; otherwise a touch screen. */
    finePointer?: boolean;
    /** location.search — the diagnostics / bisect switches (?lite=0, ?lite=1, ?snake=0). */
    search?: string;
    /** iOS navigator.standalone (undefined elsewhere). */
    standalone?: boolean;
    /** Whether (display-mode: standalone) matches. */
    displayStandalone?: boolean;
    then?: (
      viewport: Viewport,
      fire: (type: string) => void,
      heroHeight: () => string | undefined,
      page: BootPage,
    ) => void;
  } = {},
): Page {
  const classes = new Set<string>();
  const properties = new Map<string, string>();
  // every listener gets an event, as in a browser (the tap guard reads its target)
  const listeners = new Map<string, Array<(event: { type: string }) => void>>();
  const documentElement = {
    classList: {
      add: (...names: string[]) => names.forEach(name => classes.add(name)),
      remove: (...names: string[]) => names.forEach(name => classes.delete(name)),
      contains: (name: string) => classes.has(name),
    },
    style: { setProperty: (name: string, value: string) => properties.set(name, value) },
  };
  const viewport: Viewport = { innerWidth: 390, innerHeight: 844, scrollY: 0 };
  const addEventListener = (type: string, listener: (event: { type: string }) => void): void => {
    listeners.set(type, [...(listeners.get(type) ?? []), listener]);
  };
  const fire = (type: string): void => (listeners.get(type) ?? []).forEach(listener => listener({ type }));
  let timers: Array<{ run: () => void; ms: number }> = [];
  const setTimeout = (run: () => void, ms: number): number => timers.push({ run, ms });
  const page: BootPage = {
    addClass: name => classes.add(name),
    runTimers: () => {
      const due = timers;
      timers = [];
      due.forEach(timer => timer.run());
      return due.map(timer => timer.ms);
    },
  };
  const globals: PropertyDescriptorMap = {
    innerWidth: { get: () => viewport.innerWidth, configurable: true },
    innerHeight: { get: () => viewport.innerHeight, configurable: true },
    scrollY: { get: () => viewport.scrollY, configurable: true },
    addEventListener: { value: addEventListener, configurable: true, writable: true },
  };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperties(globalThis, globals);
  try {
    const window = {
      get innerWidth() {
        return viewport.innerWidth;
      },
      get innerHeight() {
        return viewport.innerHeight;
      },
      get scrollY() {
        return viewport.scrollY;
      },
      addEventListener,
      setTimeout,
      location: { search },
      matchMedia: (query: string) => ({
        matches:
          (reducedMotion && query.includes('reduce')) ||
          (displayStandalone && query.includes('display-mode: standalone')) ||
          (finePointer && query === FINE_HOVER_QUERY),
      }),
    };
    const run = new Function('window', 'document', 'navigator', MOTION_BOOT);
    run(window, { documentElement }, { userAgent, standalone });
    then?.(viewport, fire, () => properties.get('--hero-h'), page);
  } finally {
    saved.forEach((descriptor, key) => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  return { classes: [...classes].sort(), heroHeight: properties.get('--hero-h') };
}

describe('MOTION_BOOT', () => {
  it('gives an in-app browser lite motion and a cover height in px', () => {
    expect(runBoot(IN_APP.telegramAndroid)).toEqual({
      classes: [IN_APP_CLASS, HERO_PX_CLASS, 'motion', LITE_CLASS, SCROLLBAR_CLASS].sort(),
      heroHeight: '844px',
    });
  });

  it('keeps the in-app cover height without motion (reduced motion)', () => {
    expect(runBoot(IN_APP.instagramIos, { reducedMotion: true })).toEqual({
      classes: [IN_APP_CLASS, HERO_PX_CLASS, SCROLLBAR_CLASS].sort(),
      heroHeight: '844px',
    });
  });

  it('gives a regular browser the scroll scenes; the cover in px on a touch screen, 100svh on a desktop', () => {
    // a touch screen: an in-app WebView posing as Chrome (Telegram) cannot be told from it
    expect(runBoot(BROWSERS.chromeAndroid)).toEqual({
      classes: [HERO_PX_CLASS, 'motion', 'motion-pending', SCROLLBAR_CLASS].sort(),
      heroHeight: '844px',
    });
    expect(runBoot(BROWSERS.chromeDesktop, { finePointer: true })).toEqual({
      classes: ['motion', 'motion-pending', SCROLLBAR_CLASS].sort(),
      heroHeight: undefined,
    });
    // an in-app browser keeps the px height whatever drives it
    expect(runBoot(IN_APP.telegramAndroid, { finePointer: true }).heroHeight).toBe('844px');
  });

  it('gives the iOS home-screen web app the full site, like Safari', () => {
    const full = { classes: [HERO_PX_CLASS, 'motion', 'motion-pending', SCROLLBAR_CLASS].sort(), heroHeight: '844px' };
    expect(runBoot(HOME_SCREEN_IOS, { standalone: true })).toEqual(full);
    expect(runBoot(HOME_SCREEN_IOS, { standalone: false, displayStandalone: true })).toEqual(full);
    // the same UA in an app's WKWebView (navigator.standalone false) stays lite
    expect(runBoot(HOME_SCREEN_IOS, { standalone: false })).toEqual({
      classes: [IN_APP_CLASS, HERO_PX_CLASS, 'motion', LITE_CLASS, SCROLLBAR_CLASS].sort(),
      heroHeight: '844px',
    });
  });

  it('swaps the native scrollbar for the snake in every browser, with reduced motion too', () => {
    expect(runBoot(BROWSERS.chromeAndroid, { reducedMotion: true })).toEqual({
      classes: [HERO_PX_CLASS, SCROLLBAR_CLASS].sort(),
      heroHeight: '844px',
    });
  });

  it('diagnostics switches: ?lite=0 / ?lite=1 force the full / lite motion, ?snake=0 keeps the native scrollbar', () => {
    const lite = {
      classes: [IN_APP_CLASS, HERO_PX_CLASS, 'motion', LITE_CLASS, SCROLLBAR_CLASS].sort(),
      heroHeight: '844px',
    };
    // only the motion switches: an in-app browser keeps html.in-app and its cover height in px
    expect(runBoot(IN_APP.telegramAndroid, { search: '?lite=0' })).toEqual({
      classes: [IN_APP_CLASS, HERO_PX_CLASS, 'motion', 'motion-pending', SCROLLBAR_CLASS].sort(),
      heroHeight: '844px',
    });
    expect(runBoot(BROWSERS.chromeAndroid, { search: '?diag=0&lite=1' })).toEqual({
      classes: [HERO_PX_CLASS, 'motion', LITE_CLASS, SCROLLBAR_CLASS].sort(),
      heroHeight: '844px',
    });
    expect(runBoot(BROWSERS.chromeAndroid, { search: '?snake=0' })).toEqual({
      classes: [HERO_PX_CLASS, 'motion', 'motion-pending', SNAKE_OFF_CLASS].sort(),
      heroHeight: '844px',
    });
    // look-alike parameters change nothing
    expect(runBoot(IN_APP.telegramAndroid, { search: '?lite=01&snake=00' })).toEqual(lite);
  });

  it("gives the native scrollbar back when the snake's script has not run 4 s after load", () => {
    let timers: number[] = [];
    const broken = runBoot(BROWSERS.chromeDesktop, {
      reducedMotion: true,
      finePointer: true,
      then: (_viewport, fire, _heroHeight, page) => {
        fire('load');
        timers = page.runTimers();
      },
    });
    expect(timers).toEqual([SCROLLBAR_FAILSAFE_MS]);
    expect(broken.classes).toEqual([]);
    // the snake is up in time (ScrollSpine): it stays the scrollbar
    const working = runBoot(IN_APP.telegramAndroid, {
      then: (_viewport, fire, _heroHeight, page) => {
        page.addClass(SCROLLBAR_READY_CLASS);
        fire('load');
        page.runTimers();
      },
    });
    expect(working.classes).toContain(SCROLLBAR_CLASS);
  });

  it.each([
    ['an in-app browser', IN_APP.telegramAndroid],
    ["a touch screen with a Chrome UA (Telegram's WebView poses as one)", BROWSERS.chromeAndroid],
  ])(
    'keeps the cover height of %s while the WebView resizes mid-page, takes it again at the top',
    (_name, userAgent) => {
      const heights: Array<string | undefined> = [];
      const page = runBoot(userAgent, {
        then: (viewport, fire, heroHeight) => {
          // Telegram's bottom sheet expands / the toolbar collapses during the first swipe
          viewport.scrollY = 300;
          viewport.innerHeight = 964;
          fire('resize');
          fire('scroll');
          heights.push(heroHeight());
          // back at the top: the cover fills the (now taller) viewport again
          viewport.scrollY = 0;
          fire('scroll');
          heights.push(heroHeight());
          // rotation: the width changes, the height is taken wherever the page is
          viewport.scrollY = 900;
          viewport.innerWidth = 844;
          viewport.innerHeight = 390;
          fire('resize');
        },
      });
      expect(heights).toEqual(['844px', '964px']);
      expect(page.heroHeight).toBe('390px');
    },
  );
});
