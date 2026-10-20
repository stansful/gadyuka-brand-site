/*
 * Scroll diagnostics overlay — loaded only with ?diag=1 (motion/boot.ts MOTION_BOOT).
 * Shows on the device what moves the page: per-frame scroll jumps, page-height changes,
 * viewport resizes (in-app toolbars), programmatic scroll writes (with their caller),
 * touches that start on the scroll snake, clicks cancelled by the tap guard (motion/boot.ts
 * TAP_GUARD: taps that caught the page moving), long frames. Decorative, pointer-events: none.
 * Bisect switches (also MOTION_BOOT): ?lite=0 / ?lite=1 (force full / lite motion), ?snake=0.
 */
(function () {
  if (window.__gadyukaDiag) return;
  var s = (window.__gadyukaDiag = {
    frames: 0,
    long: 0,
    worst: 0,
    jumps: 0,
    maxJump: 0,
    writes: 0,
    hChanges: 0,
    resizes: 0,
    minH: Infinity,
    maxH: 0,
    touches: 0,
    snakeTouches: 0,
    scrolls: 0,
    touching: false,
    log: [],
  });
  function note(msg) {
    s.log.unshift(msg);
    if (s.log.length > 6) s.log.length = 6;
  }
  function caller() {
    // V8 starts with an "Error" line, WebKit / Gecko do not: drop it and every frame of this file.
    var stack = (new Error().stack || '').split('\n').filter(function (l) {
      return l && !/^Error/.test(l) && l.indexOf('scroll-diag.js') < 0;
    });
    var line = (stack[0] || '').trim();
    var m = line.match(/([\w$.<>]+)?\s*\(?(?:.*\/)?([^/:()]+):(\d+):(\d+)\)?$/);
    return m ? (m[1] ? m[1] + ' ' : '') + m[2] + ':' + m[4] : line.slice(0, 40);
  }
  function patch(obj, name, label) {
    var orig = obj[name];
    if (typeof orig !== 'function') return;
    obj[name] = function () {
      s.writes++;
      var arg = arguments[0];
      var top = arg && typeof arg === 'object' ? arg.top : arguments[1];
      note('W ' + label + ' →' + (top == null ? '?' : Math.round(top)) + ' ' + caller());
      return orig.apply(this, arguments);
    };
  }
  patch(window, 'scrollTo', 'scrollTo');
  patch(window, 'scroll', 'scroll');
  patch(window, 'scrollBy', 'scrollBy');
  patch(Element.prototype, 'scrollIntoView', 'intoView');
  var desc = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
  if (desc && desc.set) {
    Object.defineProperty(Element.prototype, 'scrollTop', {
      configurable: true,
      get: desc.get,
      set: function (v) {
        if (this === document.documentElement || this === document.body) {
          s.writes++;
          note('W scrollTop →' + Math.round(v) + ' ' + caller());
        }
        desc.set.call(this, v);
      },
    });
  }

  addEventListener(
    'touchstart',
    function (e) {
      s.touching = true;
      s.touches++;
      var t = e.target;
      if (t && t.closest && t.closest('.spine')) {
        s.snakeTouches++;
        note('T on snake @y' + Math.round(scrollY));
      }
    },
    { passive: true, capture: true },
  );
  addEventListener(
    'touchend',
    function () {
      s.touching = false;
    },
    { passive: true, capture: true },
  );
  addEventListener(
    'touchcancel',
    function () {
      s.touching = false;
    },
    { passive: true, capture: true },
  );
  addEventListener(
    'scroll',
    function () {
      s.scrolls++;
    },
    { passive: true },
  );
  addEventListener('resize', function () {
    s.resizes++;
    note('R ' + innerWidth + 'x' + innerHeight + ' @y' + Math.round(scrollY));
  });

  var box = document.createElement('div');
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText =
    'position:fixed;left:4px;bottom:4px;z-index:2147483647;max-width:calc(100vw - 8px);' +
    'background:rgba(0,0,0,.86);color:#3f3;border:1px solid #3f3;padding:4px 6px;' +
    'font:10px/1.35 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-all;pointer-events:none';
  var d = document.documentElement;
  var lastY = scrollY,
    lastT = performance.now(),
    lastH = d.scrollHeight,
    recent = [];
  function tick(t) {
    var dt = t - lastT;
    lastT = t;
    s.frames++;
    if (dt > 50) {
      s.long++;
      if (dt > s.worst) s.worst = Math.round(dt);
    }
    var y = scrollY,
      dy = y - lastY;
    lastY = y;
    var h = d.scrollHeight;
    if (h !== lastH) {
      s.hChanges++;
      note('H ' + lastH + '→' + h + ' @y' + Math.round(y));
      lastH = h;
    }
    var ih = innerHeight;
    if (ih < s.minH) s.minH = ih;
    if (ih > s.maxH) s.maxH = ih;
    var avg = 0;
    for (var i = 0; i < recent.length; i++) avg += Math.abs(recent[i]);
    avg = recent.length ? avg / recent.length : 0;
    if (Math.abs(dy) > 150 && Math.abs(dy) > 4 * avg + 80) {
      s.jumps++;
      if (Math.abs(dy) > s.maxJump) s.maxJump = Math.abs(Math.round(dy));
      note('J ' + Math.round(dy) + 'px @y' + Math.round(y) + ' dt' + Math.round(dt) + (s.touching ? ' finger' : ''));
      s.jumpLog = s.jumpLog || [];
      s.jumpLog.push({
        dy: Math.round(dy),
        y: Math.round(y),
        dt: Math.round(dt),
        finger: s.touching,
        avg: Math.round(avg),
        t: Math.round(t),
      });
    }
    recent.push(dy);
    if (recent.length > 5) recent.shift();
    if (s.frames % 8 === 0) {
      var cls = d.className;
      box.textContent =
        'mode ' +
        (/motion-lite/.test(cls) ? 'LITE' : /\bmotion\b/.test(cls) ? 'FULL' : 'NO-MOTION') +
        ' | in-app ' +
        (/\bin-app\b/.test(cls) ? 'yes' : 'no') +
        ' | snake ' +
        (/snake-off/.test(cls) ? 'OFF' : 'on') +
        '\n' +
        'vp ' +
        innerWidth +
        'x' +
        innerHeight +
        ' (h ' +
        s.minH +
        '–' +
        s.maxH +
        ') resizes ' +
        s.resizes +
        '\n' +
        'y ' +
        Math.round(y) +
        ' / H ' +
        h +
        ' | H changes ' +
        s.hChanges +
        '\n' +
        'JUMPS ' +
        s.jumps +
        ' (max ' +
        s.maxJump +
        ') | script scrolls ' +
        s.writes +
        '\n' +
        'touches ' +
        s.touches +
        ' (on snake ' +
        s.snakeTouches +
        ') | taps blocked ' +
        (window.__gadyukaTapsBlocked || 0) +
        ' | long ' +
        s.long +
        ' (' +
        s.worst +
        'ms)\n' +
        s.log.join('\n') +
        '\n' +
        navigator.userAgent.slice(0, 160);
    }
    requestAnimationFrame(tick);
  }
  function start() {
    document.body.appendChild(box);
    requestAnimationFrame(tick);
  }
  if (document.body) start();
  else addEventListener('DOMContentLoaded', start);
})();
