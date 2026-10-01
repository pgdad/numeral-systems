// Lesson 3: Octal & Hexadecimal (docs/plan/CONTENT.md § Lesson 3).
// Any number can be the base (an eight-fingered alien counts in octal) -> hex needs sixteen digits, so
// we borrow A-F (a sixteen-fingered creature) -> one hex digit = four binary digits (a four-fingered hand,
// then 11 1111 1111 -> 3 F F) -> hex color codes -> "You try it!": a color mixer and a dec/oct/hex counter.
//
// The characters are drawn here as inline SVG. Their fingers squash and stretch like NS.hands fingers.
// Lesson files must not touch the DOM at load time: everything happens inside setup/do.
(function (NS) {
  'use strict';

  var U = NS.util;
  var A = NS.anim;
  var D = NS.digitsets;

  function words(n) { return D.speak(n, 'decimal'); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function hidden(el) { el.style.opacity = '0'; return el; }
  function noop() {}

  // ---------- Pure helpers (unit-tested) ----------

  // Two hex digits for one color channel: hex2(255) -> "FF", hex2(10) -> "0A".
  function hex2(v) { return (v < 16 ? '0' : '') + v.toString(16).toUpperCase(); }

  // [255, 136, 0] -> "#FF8800"
  function rgbToCode(rgb) { return '#' + rgb.map(hex2).join(''); }

  // "#FF8800" or "#f80" -> [255, 136, 0]; anything else -> null.
  function codeToRgb(code) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(code || '').trim());
    if (!m) return null;
    var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); });
  }

  // How a channel's two hex digits are read aloud: speakPair(255) -> "F F", speakPair(8) -> "zero eight".
  function speakPair(v) {
    return hex2(v).split('').map(function (c) { return D.digitName(parseInt(c, 16), 'hex'); }).join(' ');
  }
  function speakCode(rgb) { return rgb.map(speakPair).join(', '); }

  // Straight-line distance between two colors in RGB space (0 .. about 441).
  function colorDistance(a, b) {
    return Math.sqrt(a.reduce(function (sum, v, i) { return sum + (v - b[i]) * (v - b[i]); }, 0));
  }

  // A color is "close enough" to a target within this distance (about a quarter of one channel).
  var TOLERANCE = 64;

  // Purple: lots of red and blue, about the same amount of each, and little green.
  function isPurple(rgb) {
    var r = rgb[0], g = rgb[1], b = rgb[2];
    return r >= 96 && b >= 96 && Math.abs(r - b) <= 80 && g <= 80;
  }

  // Color challenges for "You try it!". `show` is what "Show me" mixes; `free` has no wrong answer.
  var COLOR_CHALLENGES = [
    { id: 'yellow', name: 'yellow', target: [255, 255, 0], show: [255, 255, 0], how: 'Red and green all the way up, and no blue.' },
    { id: 'purple', name: 'purple', test: isPurple, show: [153, 0, 204], how: 'Lots of red and blue, and no green.' },
    { id: 'white', name: 'white', target: [255, 255, 255], show: [255, 255, 255], how: 'Everything all the way up!' },
    { id: 'black', name: 'black', target: [0, 0, 0], show: [0, 0, 0], how: 'Turn everything off!' },
    { id: 'favorite', name: 'your favorite color', free: true }
  ];

  function colorMatches(ch, rgb) {
    if (ch.free) return false;
    if (ch.test) return ch.test(rgb);
    return colorDistance(ch.target, rgb) <= TOLERANCE;
  }

  function challengeText(ch) {
    if (ch.free) return 'Mix your favorite color, then press This one!';
    return 'Can you make ' + ch.name + '?';
  }

  // Index of the challenge after `index` that isn't already met (wraps; -1 starts at the first).
  function nextChallenge(index, rgb, list) {
    list = list || COLOR_CHALLENGES;
    for (var k = 1; k <= list.length; k++) {
      var i = (index + k + list.length) % list.length;
      if (!colorMatches(list[i], rgb)) return i;
    }
    return (index + 1) % list.length;
  }

  // The -/+ buttons move a channel to the next multiple of 17 (0x11): 00, 11, 22 ... EE, FF.
  var STEP = 17;
  function stepChannel(v, dir) {
    var next = dir > 0 ? (Math.floor(v / STEP) + 1) * STEP : (Math.ceil(v / STEP) - 1) * STEP;
    return U.clamp(next, 0, 255);
  }

  // The counter goes from 0 to 4095: 7777 in octal, FFF in hex.
  var COUNTER_MAX = 4095;
  function counterNext(n, delta) { return U.clamp(n + delta, 0, COUNTER_MAX); }

  // How many digits change from `a` to `b` in a base (2 or more means something rolled over).
  function changedPlaces(a, b, base) {
    var places = Math.max(NS.numeral.toDigits(a, base).length, NS.numeral.toDigits(b, base).length);
    var da = NS.numeral.padDigits(NS.numeral.toDigits(a, base), places);
    var db = NS.numeral.padDigits(NS.numeral.toDigits(b, base), places);
    return da.filter(function (d, i) { return d !== db[i]; }).length;
  }

  // Binary digits in groups of four, starting from the right: nibbles(1023) -> ['11', '1111', '1111'].
  function nibbles(n) {
    var bits = n.toString(2);
    var out = [];
    for (var end = bits.length; end > 0; end -= 4) out.unshift(bits.slice(Math.max(0, end - 4), end));
    return out;
  }
  // One hex digit per group: nibbleHex(1023) -> ['3', 'F', 'F'] (the same as writing n in hex).
  function nibbleHex(n) {
    return nibbles(n).map(function (g) { return parseInt(g, 2).toString(16).toUpperCase(); });
  }

  // Number of each step that the narrated scenes come to rest on (checked in tests).
  var ALL_TEN = 1023;        // all ten fingers up -> 3FF
  var BYTE = 0xFA;           // 1111 1010 -> F A
  var OCT_FROM = 4, OCT_TO = 9;      // the octal count: 4, 5, 6, 7, 10, 11
  var HEX_FROM = 13, HEX_TO = 17;    // the hex count: D, E, F, 10, 11
  var DEMO_COLORS = {
    red: [255, 0, 0], green: [0, 255, 0], blue: [0, 0, 255], yellow: [255, 255, 0],
    orange: [255, 136, 0], pink: [255, 102, 204], 'sky blue': [51, 187, 255]
  };
  var PRAISE = ['Yes!', 'You got it!', 'Great job!', 'Super!', 'Wow, well done!'];

  // ---------- Characters and their fingers ----------

  var FINGER_UP = 'scale(1, 1)', FINGER_DOWN = 'scale(1, 0.32)';

  // One cartoon finger pivoting at its parent's origin. `flex` squashes for up/down, like NS.hands.
  function drawFinger(transform, len, w) {
    var flex = U.svg('g', { class: 'oh-flex' },
      U.svg('rect', { class: 'oh-skin', x: -w / 2, y: -len, width: w, height: len + 8, rx: w / 2 }),
      U.svg('ellipse', { class: 'oh-tip', cx: 0, cy: -len + w * 0.6, rx: w * 0.27, ry: w * 0.34 }));
    var outer = U.svg('g', { class: 'oh-finger', transform: transform }, flex);
    return { outer: outer, flex: flex, up: true };
  }

  function moveFinger(f, up, ctx) {
    if (f.up === up) return Promise.resolve();
    f.up = up;
    f.outer.classList.toggle('is-down', !up);
    var kf = up
      ? [{ transform: FINGER_DOWN }, { transform: 'scale(0.92, 1.08)', offset: 0.6 }, { transform: FINGER_UP }]
      : [{ transform: FINGER_UP }, { transform: 'scale(1.1, 0.26)', offset: 0.7 }, { transform: FINGER_DOWN }];
    return A.run(f.flex, kf, { duration: 340, easing: 'ease-out' }, ctx);
  }

  // Changed fingers move one after another, right to left.
  function setFingers(list, states, ctx) {
    var changed = [];
    list.forEach(function (f, i) { if (f.up !== !!states[i]) changed.push(i); });
    changed.reverse();
    return A.stagger(changed, function (i) { return moveFinger(list[i], !!states[i], ctx); }, 60, ctx);
  }

  // Fingers light up one after another, then all go back to normal.
  function glowFingers(list, ctx, gap) {
    if (ctx.instant) return Promise.resolve();
    function off() { list.forEach(function (f) { f.outer.classList.remove('is-glowing'); }); }
    return A.stagger(list, function (f) {
      f.outer.classList.add('is-glowing');
      return Promise.resolve();
    }, gap || 140, ctx).then(function () { return A.wait(700, ctx); }).then(off, function (e) { off(); throw e; });
  }

  // A thick cartoon arm (outline underneath, fill on top).
  function arm(d) {
    return [U.svg('path', { class: 'oh-arm-line', d: d }), U.svg('path', { class: 'oh-arm', d: d })];
  }

  // A round palm at (x, y) with four fingers fanned out, pointing `rot` degrees from straight up.
  function fanHand(x, y, rot, fingers) {
    var list = [-39, -13, 13, 39].map(function (a) { return drawFinger('rotate(' + a + ') translate(0 -8)', 30, 11); });
    list.forEach(function (f) { fingers.push(f); });
    var wave = U.svg('g', { class: 'oh-wave' }, list.map(function (f) { return f.outer; }),
      U.svg('circle', { class: 'oh-skin', cx: 0, cy: 0, r: 15 }));
    return { g: U.svg('g', { transform: 'translate(' + x + ' ' + y + ') rotate(' + rot + ')' }, wave), wave: wave };
  }

  function eye(cx, cy, r) {
    return [U.svg('circle', { class: 'oh-eye', cx: cx, cy: cy, r: r }),
      U.svg('circle', { class: 'oh-pupil', cx: cx + r * 0.2, cy: cy + r * 0.15, r: r * 0.45 }),
      U.svg('circle', { class: 'oh-shine', cx: cx + r * 0.35, cy: cy - r * 0.1, r: r * 0.14 })];
  }

  // A friendly purple alien with eight fingers (four on each hand). Counts in octal.
  function alienArt() {
    var fingers = [];
    var hands = [fanHand(50, 102, -22, fingers), fanHand(250, 102, 22, fingers)];
    var svg = U.svg('svg', { class: 'oh-critter oh-alien', viewBox: '0 0 300 262', role: 'img',
      'aria-label': 'A friendly purple alien with eight fingers, four on each hand' },
      U.svg('path', { class: 'oh-line', d: 'M128 96 L112 44 M172 96 L188 44' }),
      U.svg('circle', { class: 'oh-ball', cx: 112, cy: 40, r: 10 }),
      U.svg('circle', { class: 'oh-ball', cx: 188, cy: 40, r: 10 }),
      arm('M100 172 Q62 166 54 118'), arm('M200 172 Q238 166 246 118'),
      U.svg('ellipse', { class: 'oh-skin', cx: 122, cy: 240, rx: 24, ry: 13 }),
      U.svg('ellipse', { class: 'oh-skin', cx: 178, cy: 240, rx: 24, ry: 13 }),
      U.svg('ellipse', { class: 'oh-body', cx: 150, cy: 166, rx: 70, ry: 76 }),
      eye(150, 140, 30),
      U.svg('path', { class: 'oh-line', d: 'M126 196 Q150 216 174 196' }),
      hands.map(function (h) { return h.g; }));
    return { el: svg, fingers: fingers, waves: hands.map(function (h) { return h.wave; }) };
  }

  // A silly orange creature with four hands and sixteen fingers. Counts in hex.
  function creatureArt() {
    var fingers = [];
    var hands = [fanHand(60, 74, -38, fingers), fanHand(300, 74, 38, fingers),
      fanHand(40, 204, -100, fingers), fanHand(320, 204, 100, fingers)];
    var svg = U.svg('svg', { class: 'oh-critter oh-creature', viewBox: '0 0 360 282', role: 'img',
      'aria-label': 'A silly orange creature with four hands and sixteen fingers' },
      arm('M128 128 Q86 116 68 86'), arm('M232 128 Q274 116 292 86'),
      arm('M112 196 Q78 210 52 206'), arm('M248 196 Q282 210 308 206'),
      U.svg('path', { class: 'oh-line', d: 'M160 92 L146 50 M200 92 L214 50' }),
      U.svg('circle', { class: 'oh-body', cx: 180, cy: 166, r: 84 }),
      U.svg('circle', { class: 'oh-spot', cx: 132, cy: 200, r: 10 }),
      U.svg('circle', { class: 'oh-spot', cx: 232, cy: 136, r: 8 }),
      U.svg('circle', { class: 'oh-spot', cx: 224, cy: 214, r: 12 }),
      eye(146, 42, 18), eye(214, 42, 18),
      U.svg('path', { class: 'oh-mouth', d: 'M140 178 Q180 226 220 178 Z' }),
      U.svg('rect', { class: 'oh-tooth', x: 170, y: 178, width: 14, height: 13, rx: 2 }),
      hands.map(function (h) { return h.g; }));
    return { el: svg, fingers: fingers, waves: hands.map(function (h) { return h.wave; }) };
  }

  function waveHands(art, ctx) {
    return A.parallel.apply(null, art.waves.map(function (w, i) {
      return A.run(w, [
        { transform: 'rotate(0deg)' }, { transform: 'rotate(14deg)' }, { transform: 'rotate(-12deg)' },
        { transform: 'rotate(8deg)' }, { transform: 'rotate(0deg)' }
      ], { duration: 1100, easing: 'ease-in-out', delay: i * 90 }, ctx, 'transient');
    }));
  }

  // A big four-fingered hand for binary: fingers worth 8, 4, 2, 1 (left to right), value badges above
  // and the binary digits underneath.
  var FOUR_X = [44, 74, 104, 134], FOUR_W = 178;
  function fourHand(n) {
    var fingers = FOUR_X.map(function (x, i) {
      return drawFinger('translate(' + x + ' 116) rotate(' + [-7, -2, 2, 7][i] + ')', 74, 25);
    });
    var badges = FOUR_X.map(function (x, i) {
      return U.svg('g', { class: 'oh-badge', transform: 'translate(' + x + ' 17)' },
        U.svg('rect', { x: -15, y: -13, width: 30, height: 26, rx: 13 }),
        U.svg('text', { x: 0, y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, String(8 >> i)));
    });
    var svg = U.svg('svg', { class: 'oh-four-svg', viewBox: '0 0 ' + FOUR_W + ' 214', 'aria-hidden': 'true' },
      badges, fingers.map(function (f) { return f.outer; }),
      U.svg('rect', { class: 'oh-skin', x: 22, y: 102, width: 134, height: 78, rx: 34 }),
      U.svg('path', { class: 'oh-crease', d: 'M60 140 q10 5 20 0 M98 140 q10 5 20 0' }),
      U.svg('rect', { class: 'oh-sleeve', x: 42, y: 172, width: 94, height: 40, rx: 12 }));
    var cells = FOUR_X.map(function (x) {
      return U.el('span', { class: 'oh-bit', style: { left: (x / FOUR_W * 100).toFixed(2) + '%' } });
    });
    var el = U.el('div', { class: 'oh-four', role: 'img' }, svg, U.el('div', { class: 'oh-strip' }, cells));
    var value = null;

    function show(v, ctx) {
      var bits = NS.numeral.padDigits(NS.numeral.toDigits(v, 2), 4).map(Boolean);
      var flashes = [];
      cells.forEach(function (c, i) {
        var text = bits[i] ? '1' : '0';
        var changed = value !== null && c.textContent !== text;
        c.textContent = text;
        c.classList.toggle('is-one', bits[i]);
        if (changed) {
          flashes.push(A.run(c, [{ transform: 'translateX(-50%) scale(1)' }, { transform: 'translateX(-50%) scale(1.3)', offset: 0.3 },
            { transform: 'translateX(-50%) scale(1)' }], { duration: 400, easing: 'ease-out' }, ctx, 'transient'));
        }
      });
      value = v;
      el.setAttribute('aria-label', 'A four-fingered hand showing binary ' + bits.map(Number).join(''));
      return A.parallel(setFingers(fingers, bits, ctx), Promise.all(flashes));
    }

    fingers.forEach(function (f) { f.up = true; });
    show(n || 0, { instant: true });
    return { el: el, fingers: fingers, show: show, get value() { return value; } };
  }

  // ---------- Small widgets ----------

  // A row of digit tiles with a name: "Base-10  0 1 2 ... 9".
  function strip(name, set, count, theme) {
    var tiles = U.range(count).map(function (v) { return NS.digitTile.create({ set: set, value: v, size: 'sm' }); });
    var row = U.el('div', { class: ['oh-strip-row', 'theme-' + theme] },
      U.el('span', { class: 'oh-strip-name', text: name }),
      U.el('span', { class: 'oh-strip-tiles' }, tiles.map(function (t) { return t.el; })));
    return { row: row, tiles: tiles };
  }

  // An odometer with a "Decimal: n" readout beside it.
  function counterBox(set, places, value, extraClass) {
    var odo = NS.odometer.create({ set: set, places: places, value: value, labels: 'names', size: 'lg' });
    var dec = U.el('span', { class: 'oh-dec-num', text: String(value) });
    var el = U.el('div', { class: ['oh-countbox', 'theme-' + odo.digitSet.theme, extraClass] },
      U.el('div', { class: 'oh-countbox-odo' }, U.el('span', { class: 'oh-odo-name', text: odo.digitSet.shortName === 'hex' ? 'Hex' : 'Octal' }), odo.el),
      U.el('div', { class: 'oh-dec' }, U.el('span', { class: 'oh-odo-name oh-odo-name-dec', text: 'Decimal' }), dec));
    return {
      el: el, odo: odo, dec: dec,
      step: function (ctx) {
        dec.textContent = String(odo.value + 1);
        return A.parallel(odo.step(1, ctx), A.pop(dec, ctx, { duration: 300 }));
      }
    };
  }

  // Stars that shoot out of `layer` and fade (transient: nothing is left behind).
  function burst(layer, ctx, count) {
    if (ctx.instant) return Promise.resolve();
    var n = ctx.reducedMotion ? 1 : (count || 10);
    var box = U.el('div', { class: 'oh-burst', 'aria-hidden': 'true' });
    U.range(n).forEach(function (i) {
      var star = NS.icons.render('star', { class: 'oh-burst-star' });
      star.style.setProperty('--a', (i * 360 / n) + 'deg');
      box.appendChild(star);
    });
    layer.appendChild(box);
    function done() { if (box.parentNode) box.parentNode.removeChild(box); }
    return A.wait(1500, ctx).then(done, function (e) { done(); throw e; });
  }

  // ---------- Color mixer ----------

  var CHANNELS = [
    { key: 'red', name: 'Red', color: '#e53935' },
    { key: 'green', name: 'Green', color: '#2fb344' },
    { key: 'blue', name: 'Blue', color: '#1e6fe0' }
  ];
  var mixerIds = 0;

  // Three sliders (00-FF) with each channel's hex pair and decimal value, a live swatch and the #RRGGBB code.
  //   mixer.set([r, g, b], ctx)   glide to a color (instant: jump)
  //   mixer.onChange(fn)          called with [r, g, b] when the child moves a slider or presses -/+
  // Not interactive: the sliders are display-only (disabled, not focusable) and there are no -/+ buttons.
  function makeMixer(opts) {
    opts = opts || {};
    var interactive = !!opts.interactive;
    var rgb = (opts.rgb || [0, 0, 0]).slice();
    var changeCb = null;
    var swatch = U.el('div', { class: 'oh-swatch', role: 'img' });
    var pairs = CHANNELS.map(function (c) { return U.el('span', { class: 'oh-pair oh-pair-' + c.key }); });
    var code = U.el('div', { class: 'oh-code' }, U.el('span', { class: 'oh-hash', text: '#' }), pairs);
    var name = U.el('div', { class: 'oh-color-name' });

    var rows = CHANNELS.map(function (c, i) {
      var id = 'oh-channel-' + (++mixerIds);
      var input = U.el('input', { type: 'range', id: id, class: 'oh-range', min: '0', max: '255', step: '1', value: String(rgb[i]) });
      input.style.setProperty('--ch', c.color);
      if (!interactive) { input.disabled = true; input.tabIndex = -1; }
      input.addEventListener('input', function () { setChannel(i, parseInt(input.value, 10)); });
      function nudgeButton(dir) {
        return U.el('button', { type: 'button', class: 'btn oh-nudge', 'aria-label': (dir > 0 ? 'More ' : 'Less ') + c.key,
          onClick: function () { setChannel(i, stepChannel(rgb[i], dir)); } },
        NS.icons.render(dir > 0 ? 'plus' : 'minus', { kind: 'ui' }));
      }
      var hex = U.el('span', { class: 'oh-ch-hex' });
      var dec = U.el('span', { class: 'oh-ch-dec' });
      var row = U.el('div', { class: 'oh-ch oh-ch-' + c.key },
        U.el('label', { class: 'oh-ch-name', for: id, text: c.name }),
        interactive ? nudgeButton(-1) : null, input, interactive ? nudgeButton(1) : null,
        U.el('span', { class: 'oh-ch-vals', 'aria-hidden': 'true' }, hex, dec));
      return { row: row, input: input, hex: hex, dec: dec };
    });

    var el = U.el('div', { class: ['oh-mixer', interactive ? 'is-interactive' : ''] },
      U.el('div', { class: 'oh-swatch-wrap' }, swatch, code, name),
      U.el('div', { class: 'oh-channels' }, rows.map(function (r) { return r.row; })));

    function draw() {
      rows.forEach(function (r, i) {
        var v = rgb[i];
        if (parseInt(r.input.value, 10) !== v) r.input.value = String(v);
        r.hex.textContent = hex2(v);
        r.dec.textContent = String(v);
        r.input.style.setProperty('--pct', (v / 255 * 100).toFixed(1) + '%');
        // Screen readers announce this whenever the slider moves: "255, hex F F".
        r.input.setAttribute('aria-valuetext', v + ', hex ' + speakPair(v));
        pairs[i].textContent = hex2(v);
      });
      var c = rgbToCode(rgb);
      swatch.style.background = c;
      swatch.setAttribute('aria-label', 'Color ' + c);
      el.dataset.code = c;
    }

    function setChannel(i, v) {
      rgb[i] = U.clamp(v | 0, 0, 255);
      draw();
      if (changeCb) changeCb(rgb.slice());
    }

    function glide(target, ctx) {
      ctx = ctx || {};
      var from = rgb.slice();
      function land() { rgb = target.slice(); draw(); }
      if (ctx.instant || ctx.reducedMotion) {
        land();
        return ctx.signal && ctx.signal.aborted ? Promise.reject(U.abortError()) : Promise.resolve();
      }
      var frames = 14;
      var chain = Promise.resolve();
      U.range(1, frames + 1).forEach(function (k) {
        chain = chain.then(function () { return A.wait(45, ctx); }).then(function () {
          var t = k / frames;
          t = t * (2 - t);
          rgb = from.map(function (f, i) { return Math.round(f + (target[i] - f) * t); });
          draw();
        });
      });
      return chain.then(land, function (e) { land(); throw e; });
    }

    draw();
    return {
      el: el, swatch: swatch, code: code, pairs: pairs, name: name,
      rows: rows.map(function (r) { return r.row; }),
      inputs: rows.map(function (r) { return r.input; }),
      get: function () { return rgb.slice(); },
      set: glide,
      onChange: function (fn) { changeCb = fn; }
    };
  }

  // ---------- 3.1 Any number can be the base ----------

  var anyBase = {
    id: 'any',
    title: 'Any number can be the base',
    setup: function (stage) {
      var ten = strip('Base‑10', 'decimal', 10, 'base10');
      var two = strip('Binary', 'binary', 2, 'binary');
      var eight = strip('Octal', 'octal', 8, 'octal');
      [ten.row, two.row, eight.row].forEach(hidden);
      eight.tiles.forEach(function (t) { hidden(t.el); });
      var any = hidden(U.el('div', { class: 'oh-any', text: 'Any number of digits?' }));
      var strips = U.el('div', { class: 'oh-strips' }, ten.row, two.row, eight.row, any);
      var alien = alienArt();
      var alienWrap = hidden(U.el('div', { class: 'oh-critter-wrap theme-octal' }, alien.el));
      var counter = counterBox('octal', 2, OCT_FROM, 'oh-oct-count');
      counter.el.hidden = true;
      var pv = NS.placeValue.create({ set: 'octal', value: OCT_TO, places: 3, arrows: true, tileSize: 'sm', class: 'oh-pv' });
      hidden(pv.el);
      var root = U.el('div', { class: 'oh-scene oh-any-scene' },
        U.el('div', { class: 'oh-row' }, alienWrap, U.el('div', { class: 'oh-any-right' }, strips, counter.el)), pv.el);
      stage.appendChild(root);
      return { ten: ten, two: two, eight: eight, any: any, strips: strips, alien: alien, alienWrap: alienWrap, counter: counter, pv: pv };
    },
    steps: [
      {
        say: "We've counted with ten digits, and with just two digits. But we can pick any number of digits!",
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('whoosh');
          return A.pop(s.ten.row, ctx).then(function () { return ctx.wait(900); }).then(function () {
            ctx.sound('whoosh');
            return A.pop(s.two.row, ctx);
          }).then(function () { return ctx.cue(1); }).then(function () {
            ctx.sound('pop');
            return A.pop(s.any, ctx);
          });
        }
      },
      {
        say: 'Imagine an alien with eight fingers. Four on each hand!',
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('pop');
          return A.pop(s.alienWrap, ctx).then(function () { return waveHands(s.alien, ctx); })
            .then(function () { return ctx.cue(1); })
            .then(function () { return glowFingers(s.alien.fingers, ctx); });
        }
      },
      {
        say: 'An eight-fingered alien would count in octal. Octal has eight digits: zero, one, two, three, four, five, six, seven.',
        do: function (ctx) {
          var s = ctx.state;
          return A.fadeOut(s.any, ctx).then(function () {
            s.any.hidden = true;
            ctx.sound('pop');
            return A.pop(s.eight.row, ctx);
          }).then(function () { return ctx.cue(1); }).then(function () {
            return A.stagger(s.eight.tiles, function (t) {
              ctx.sound('pop');
              return t.pop(ctx);
            }, 380, ctx);
          });
        }
      },
      {
        say: "Let's count in octal. Five. Six. Seven. And then? There's no digit eight! So we write one-zero. That means eight! One-one.",
        do: function (ctx) {
          var s = ctx.state;
          var c = s.counter;
          var chain = A.parallel(A.fadeOut(s.ten.row, ctx), A.fadeOut(s.two.row, ctx)).then(function () {
            s.ten.row.hidden = true;
            s.two.row.hidden = true;
            c.el.hidden = false;
            ctx.sound('whoosh');
            return A.pop(c.el, ctx);
          });
          // Five, six, seven (sentences 1-3).
          [1, 2, 3].forEach(function (k) {
            chain = chain.then(function () { return ctx.cue(k); }).then(function () {
              ctx.sound('click');
              return c.step(ctx);
            });
          });
          return chain.then(function () { return ctx.cue(4); }).then(function () {
            return A.parallel(c.odo.highlightPlace(0, ctx), s.eight.tiles[7].bounce(ctx));
          }).then(function () { return ctx.cue(5); }).then(function () {
            return c.odo.highlightPlace(0, ctx);
          }).then(function () { return ctx.cue(6); }).then(function () {
            ctx.sound('carry');
            return A.parallel(c.step(ctx), ctx.wait(450).then(function () { return c.odo.highlightPlace(1, ctx); }));
          }).then(function () { return ctx.cue(7); }).then(function () {
            ctx.sound('ding');
            return A.parallel(A.bounce(c.dec, ctx), A.highlight(c.dec, ctx));
          }).then(function () { return ctx.cue(8); }).then(function () {
            ctx.sound('click');
            return c.step(ctx);
          });
        }
      },
      {
        say: 'Each octal place is worth eight times more than the one before. Ones. Eights. Sixty-fours.',
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('whoosh');
          var chain = A.pop(s.pv.el, ctx);
          [0, 1, 2].forEach(function (power, k) {
            chain = chain.then(function () { return ctx.cue(k + 1); }).then(function () {
              ctx.sound('pop');
              return s.pv.highlightPlace(power, ctx);
            });
          });
          return chain;
        }
      },
      {
        say: 'So one-one in octal means one eight, plus one more. That makes nine!',
        do: function (ctx) {
          var s = ctx.state;
          return s.pv.expand(ctx).then(function () { return ctx.cue(1); }).then(function () {
            ctx.sound('ding');
            return A.parallel(A.highlight(s.pv.el.querySelector('.pv-total'), ctx), A.bounce(s.counter.dec, ctx));
          });
        }
      }
    ]
  };

  // ---------- 3.2 Hexadecimal: sixteen digits ----------

  var LETTERS = [10, 11, 12, 13, 14, 15];

  var hexDigits = {
    id: 'hex',
    title: 'Hexadecimal: sixteen digits',
    setup: function (stage) {
      var creature = creatureArt();
      var creatureWrap = hidden(U.el('div', { class: 'oh-critter-wrap oh-creature-wrap' }, creature.el));
      var tiles = U.range(16).map(function (v) {
        var t = NS.digitTile.create({ set: 'hex', value: v < 10 ? v : null, size: 'sm' });
        hidden(t.el);
        var tag = v < 10 ? null : hidden(U.el('span', { class: 'oh-tag', text: '= ' + v }));
        return { tile: t, tag: tag, cell: U.el('span', { class: 'oh-hex-cell' }, t.el, tag) };
      });
      var grid = U.el('div', { class: 'oh-hex-grid' }, tiles.map(function (x) { return x.cell; }));
      var counter = counterBox('hex', 2, HEX_FROM, 'oh-hex-count');
      counter.el.hidden = true;
      var stamp = hidden(U.el('div', { class: 'oh-stamp', text: 'HEX' }));
      var root = U.el('div', { class: 'oh-scene oh-hex-scene' },
        U.el('div', { class: 'oh-row' }, creatureWrap, U.el('div', { class: 'oh-hex-right' }, grid,
          U.el('div', { class: 'oh-hex-bottom' }, counter.el, stamp))));
      stage.appendChild(root);
      return { creature: creature, creatureWrap: creatureWrap, tiles: tiles, counter: counter, stamp: stamp };
    },
    steps: [
      {
        say: 'Now imagine a creature with sixteen fingers! It has four hands, with four fingers on each.',
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('pop');
          return A.pop(s.creatureWrap, ctx).then(function () { return waveHands(s.creature, ctx); })
            .then(function () { return ctx.cue(1); })
            .then(function () { return glowFingers(s.creature.fingers, ctx, 90); });
        }
      },
      {
        say: 'To count with sixteen fingers, we need sixteen digits. But our digits stop at nine! So we borrow some letters.',
        do: function (ctx) {
          var s = ctx.state;
          var digits = s.tiles.slice(0, 10), letters = s.tiles.slice(10);
          return A.stagger(digits, function (x) {
            ctx.sound('pop');
            return x.tile.pop(ctx);
          }, 160, ctx).then(function () { return ctx.cue(1); }).then(function () {
            ctx.sound('whoosh');
            return A.stagger(letters, function (x) { return x.tile.pop(ctx); }, 90, ctx);
          }).then(function () { return ctx.cue(2); }).then(function () {
            return A.stagger(letters, function (x, i) {
              ctx.sound('pop');
              return x.tile.flipTo(LETTERS[i], ctx);
            }, 220, ctx);
          });
        }
      },
      {
        say: 'A is ten. B is eleven. C is twelve. D is thirteen. E is fourteen. F is fifteen.',
        do: function (ctx) {
          var s = ctx.state;
          var chain = Promise.resolve();
          s.tiles.slice(10).forEach(function (x, k) {
            chain = chain.then(function () { return ctx.cue(k); }).then(function () {
              ctx.sound('pop');
              x.tile.setLit(true);
              return A.parallel(x.tile.bounce(ctx), A.pop(x.tag, ctx));
            });
          });
          return chain;
        }
      },
      {
        say: "Let's count in hex. E. F. And then? One-zero! In hex, one-zero means sixteen. One-one.",
        do: function (ctx) {
          var s = ctx.state;
          var c = s.counter;
          c.el.hidden = false;
          ctx.sound('whoosh');
          var chain = A.pop(c.el, ctx);
          [1, 2].forEach(function (k) {
            chain = chain.then(function () { return ctx.cue(k); }).then(function () {
              ctx.sound('click');
              return A.parallel(c.step(ctx), s.tiles[HEX_FROM + k].tile.bounce(ctx));
            });
          });
          return chain.then(function () { return ctx.cue(3); }).then(function () {
            return c.odo.highlightPlace(0, ctx);
          }).then(function () { return ctx.cue(4); }).then(function () {
            ctx.sound('carry');
            return A.parallel(c.step(ctx), ctx.wait(450).then(function () { return c.odo.highlightPlace(1, ctx); }));
          }).then(function () { return ctx.cue(5); }).then(function () {
            ctx.sound('ding');
            return A.parallel(A.bounce(c.dec, ctx), A.highlight(c.dec, ctx));
          }).then(function () { return ctx.cue(6); }).then(function () {
            ctx.sound('click');
            return c.step(ctx);
          });
        }
      },
      {
        say: 'Hexadecimal is a long word, so people just say hex!',
        do: function (ctx) {
          var s = ctx.state;
          return ctx.cue(0).then(function () { return ctx.wait(1200); }).then(function () {
            ctx.sound('tada');
            s.stamp.style.opacity = '1';
            return A.run(s.stamp, [
              { transform: 'rotate(-14deg) scale(2.6)', opacity: 0 },
              { transform: 'rotate(-14deg) scale(0.9)', opacity: 1, offset: 0.7 },
              { transform: 'rotate(-10deg) scale(1)', opacity: 1 }
            ], { duration: 520, easing: 'ease-in' }, ctx);
          }).then(function () { return A.wiggle(s.creatureWrap, ctx); });
        }
      }
    ]
  };

  // ---------- 3.3 Hex and binary are best friends ----------

  var friends = {
    id: 'nibbles',
    title: 'Hex and binary are best friends',
    setup: function (stage) {
      var hand1 = fourHand(0), hand2 = fourHand(0);
      var tile1 = NS.digitTile.create({ set: 'hex', value: 0, size: 'lg' });
      var tile2 = NS.digitTile.create({ set: 'hex', value: 0, size: 'lg' });
      var pair1 = hidden(U.el('div', { class: 'oh-pair-col' }, hand1.el, U.el('span', { class: 'oh-equals', text: '=' }), tile1.el));
      var pair2 = hidden(U.el('div', { class: 'oh-pair-col' }, hand2.el, U.el('span', { class: 'oh-equals', text: '=' }), tile2.el));
      var byte = hidden(U.el('div', { class: 'oh-byte' },
        U.el('span', { class: 'oh-byte-bin', text: nibbles(BYTE).join(' ') }), U.el('span', { class: 'oh-arrow', text: '→' }),
        U.el('strong', { text: nibbleHex(BYTE).join('') })));
      var panelA = U.el('div', { class: 'oh-panel' }, U.el('div', { class: 'oh-row oh-pairs' }, pair1, pair2), byte);

      var hands = NS.hands.create({ hands: 'both', bits: 0 });
      var groups = nibbles(ALL_TEN).map(function (g, gi) {
        var bits = g.split('').map(function (b) { return U.el('span', { class: 'oh-gbit', text: b }); });
        var tile = NS.digitTile.create({ set: 'hex', value: parseInt(g, 2), size: 'md' });
        hidden(tile.el);
        return { bits: bits, tile: tile, box: U.el('span', { class: 'oh-group' }, U.el('span', { class: 'oh-group-bits' }, bits), tile.el), gi: gi };
      });
      var groupRow = hidden(U.el('div', { class: 'oh-groups', role: 'img', 'aria-label': 'Binary ' + ALL_TEN.toString(2) },
        groups.map(function (g) { return g.box; })));
      var answer = hidden(U.el('div', { class: 'oh-answer' },
        U.el('span', { class: 'oh-answer-hex', text: nibbleHex(ALL_TEN).join('') }), U.el('span', { text: ' = ' }),
        U.el('span', { class: 'oh-answer-dec', text: String(ALL_TEN) })));
      var panelB = U.el('div', { class: 'oh-panel', hidden: true }, U.el('div', { class: 'oh-small-hands' }, hands.el), groupRow, answer);

      stage.appendChild(U.el('div', { class: 'oh-scene oh-friends' }, panelA, panelB));
      return { hand1: hand1, hand2: hand2, tile1: tile1, tile2: tile2, pair1: pair1, pair2: pair2, byte: byte,
        panelA: panelA, panelB: panelB, hands: hands, groups: groups, groupRow: groupRow, answer: answer };
    },
    steps: [
      {
        say: "One hex digit fits exactly four binary digits. That's four fingers! Watch them count from zero to F.",
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('pop');
          return A.pop(s.pair1, ctx).then(function () { return ctx.cue(1); }).then(function () {
            return glowFingers(s.hand1.fingers, ctx);
          }).then(function () { return ctx.cue(2); }).then(function () {
            if (ctx.instant) { s.tile1.setValue(15); return s.hand1.show(15, ctx); }
            var chain = ctx.wait(300);
            U.range(1, 16).forEach(function (n) {
              chain = chain.then(function () {
                ctx.sound('click');
                return A.parallel(s.hand1.show(n, ctx), s.tile1.flipTo(n, ctx), ctx.wait(420));
              });
            });
            return chain.then(function () {
              ctx.sound('ding');
              return s.tile1.bounce(ctx);
            });
          });
        }
      },
      {
        say: 'Programmers use hex as a short way to write binary. One-one-one-one is F. One-zero-one-zero is A. ' +
          'So eight binary digits fit in just two hex digits!',
        do: function (ctx) {
          var s = ctx.state;
          return ctx.cue(1).then(function () {
            ctx.sound('pop');
            s.tile1.setLit(true);
            return A.parallel(glowFingers(s.hand1.fingers, ctx, 60), s.tile1.bounce(ctx));
          }).then(function () { return ctx.cue(2); }).then(function () {
            ctx.sound('pop');
            return A.pop(s.pair2, ctx);
          }).then(function () {
            ctx.sound('click');
            return A.parallel(s.hand2.show(BYTE % 16, ctx), s.tile2.flipTo(BYTE % 16, ctx));
          }).then(function () {
            s.tile2.setLit(true);
            return ctx.cue(3);
          }).then(function () {
            ctx.sound('ding');
            return A.pop(s.byte, ctx);
          });
        }
      },
      {
        say: "Remember all ten fingers up? In binary, that's ten ones in a row.",
        do: function (ctx) {
          var s = ctx.state;
          return A.fadeOut(s.panelA, ctx).then(function () {
            s.panelA.hidden = true;
            s.panelB.hidden = false;
            ctx.sound('whoosh');
            return A.pop(s.panelB, ctx);
          }).then(function () { return s.hands.setBits(ALL_TEN, ctx); }).then(function () { return ctx.cue(1); }).then(function () {
            ctx.sound('pop');
            return A.pop(s.groupRow, ctx);
          });
        }
      },
      {
        say: "Let's split them into groups of four, starting from the right.",
        do: function (ctx) {
          var s = ctx.state;
          var bits = [];
          s.groups.forEach(function (g) { bits = bits.concat(g.bits); });
          var before = ctx.instant ? null : bits.map(function (b) { return b.getBoundingClientRect().left; });
          s.groupRow.classList.add('is-split');
          s.groupRow.setAttribute('aria-label', 'Binary ' + nibbles(ALL_TEN).join(' '));
          ctx.sound('whoosh');
          var slide = before ? A.parallel.apply(null, bits.map(function (b, i) {
            var dx = before[i] - b.getBoundingClientRect().left;
            return A.run(b, [{ transform: 'translateX(' + dx + 'px)' }, { transform: 'translateX(0px)' }],
              { duration: 700, easing: 'cubic-bezier(.34,1.3,.64,1)' }, ctx);
          })) : Promise.resolve();
          // Then each group lights up, right to left.
          return slide.then(function () {
            return A.stagger(s.groups.slice().reverse(), function (g) {
              ctx.sound('pop');
              return A.highlight(g.box, ctx);
            }, 450, ctx);
          });
        }
      },
      {
        say: 'Each group becomes one hex digit. Three. F. F. So one thousand twenty-three is three F F in hex!',
        do: function (ctx) {
          var s = ctx.state;
          var chain = Promise.resolve();
          s.groups.forEach(function (g, k) {
            chain = chain.then(function () { return ctx.cue(k + 1); }).then(function () {
              ctx.sound('pop');
              return g.tile.pop(ctx);
            });
          });
          return chain.then(function () { return ctx.cue(4); }).then(function () {
            ctx.sound('tada');
            return A.pop(s.answer, ctx);
          }).then(function () { return A.highlight(s.answer, ctx); });
        }
      }
    ]
  };

  // ---------- 3.4 Secret codes in colors ----------

  // Glide the mixer to a named demo color and show the name.
  function mixTo(s, colorName, ctx) {
    s.mixer.name.textContent = colorName;
    return A.parallel(s.mixer.set(DEMO_COLORS[colorName], ctx), A.pop(s.mixer.name, ctx, { duration: 300 }));
  }

  var colors = {
    id: 'colors',
    title: 'Secret codes in colors',
    setup: function (stage) {
      var mixer = makeMixer({ rgb: DEMO_COLORS.red });
      mixer.name.textContent = 'red';
      mixer.rows.forEach(hidden);
      var labels = CHANNELS.map(function (c) { return hidden(U.el('span', { class: 'oh-pair-label oh-pair-' + c.key, text: c.key })); });
      var under = U.el('div', { class: 'oh-code-labels', 'aria-hidden': 'true' }, U.el('span', { class: 'oh-hash-space' }), labels);
      mixer.code.after(under);
      var root = hidden(U.el('div', { class: 'oh-scene oh-colors' }, mixer.el));
      stage.appendChild(root);
      return { mixer: mixer, labels: labels, root: root };
    },
    steps: [
      {
        say: 'Every color on a computer screen has a secret hex code!',
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('pop');
          return A.pop(s.root, ctx).then(function () { return A.highlight(s.mixer.code, ctx); });
        }
      },
      {
        say: 'Two hex digits for red. Two for green. Two for blue.',
        do: function (ctx) {
          var s = ctx.state;
          var chain = Promise.resolve();
          [0, 1, 2].forEach(function (i) {
            chain = chain.then(function () { return ctx.cue(i); }).then(function () {
              ctx.sound('pop');
              s.mixer.pairs[i].classList.add('is-marked');
              return A.parallel(A.pop(s.labels[i], ctx), A.pop(s.mixer.rows[i], ctx), A.bounce(s.mixer.pairs[i], ctx));
            });
          });
          return chain;
        }
      },
      {
        say: 'F F means as much as possible. Zero-zero means none. Now only green. Now only blue. Red and green together make yellow!',
        do: function (ctx) {
          var s = ctx.state;
          return A.parallel(A.highlight(s.mixer.pairs[0], ctx), A.highlight(s.mixer.rows[0], ctx)).then(function () {
            return ctx.cue(1);
          }).then(function () {
            return A.parallel(A.highlight(s.mixer.pairs[1], ctx), A.highlight(s.mixer.pairs[2], ctx));
          }).then(function () { return ctx.cue(2); }).then(function () {
            ctx.sound('whoosh');
            return mixTo(s, 'green', ctx);
          }).then(function () { return ctx.cue(3); }).then(function () {
            ctx.sound('whoosh');
            return mixTo(s, 'blue', ctx);
          }).then(function () { return ctx.cue(4); }).then(function () {
            ctx.sound('ding');
            return mixTo(s, 'yellow', ctx);
          });
        }
      },
      {
        say: 'Mix them to make any color you like! Orange. Pink. Sky blue.',
        do: function (ctx) {
          var s = ctx.state;
          var chain = Promise.resolve();
          ['orange', 'pink', 'sky blue'].forEach(function (name, k) {
            chain = chain.then(function () { return ctx.cue(k + 1); }).then(function () {
              ctx.sound('whoosh');
              return mixTo(s, name, ctx);
            });
          });
          return chain.then(function () { return A.bounce(s.mixer.swatch, ctx); });
        }
      }
    ]
  };

  // ---------- 3.5 You try it! ----------

  var COUNTERS = [
    { set: 'decimal', places: 4, name: 'Decimal' },
    { set: 'octal', places: 4, name: 'Octal' },
    { set: 'hex', places: 3, name: 'Hex' }
  ];

  var tryIt = {
    id: 'try',
    title: 'You try it!',
    interactive: true,
    setup: function (stage, setupCtx) {
      var ctrl = new AbortController();
      var signal = ctrl.signal;
      var live = { speed: 1, reducedMotion: setupCtx.reducedMotion, signal: signal };
      var s = { ctrl: ctrl, index: 0, stars: 0, busy: false, hinting: false, count: 0, sayTimer: null };

      function say(text) {
        if (signal.aborted) return;
        if (setupCtx.player && setupCtx.player.getMode() === 'playing') return;
        NS.narrator.speak('octal-hex.try.live', text, { signal: signal }).catch(noop);
      }
      function sayLater(text, ms) {
        clearTimeout(s.sayTimer);
        s.sayTimer = setTimeout(function () { say(text); }, ms || 600);
      }

      // --- Color mixer with challenges ---
      var mixer = makeMixer({ interactive: true, rgb: [255, 0, 0] });
      var prompt = U.el('p', { class: 'oh-prompt', 'aria-live': 'polite' });
      var starCount = U.el('span', { class: 'oh-star-count', text: '0' });
      var hint = U.el('button', { type: 'button', class: 'btn oh-hint', onClick: function () { showMe(); } },
        NS.icons.render('play', { kind: 'ui' }), U.el('span', { text: 'Show me' }));
      var pick = U.el('button', { type: 'button', class: 'btn btn-primary oh-pick', hidden: true, onClick: function () { celebrate(); } },
        NS.icons.render('check', { kind: 'ui' }), U.el('span', { text: 'This one!' }));
      var skip = U.el('button', { type: 'button', class: 'btn oh-skip', onClick: function () { advance(false); } }, 'Skip');
      var burstLayer = U.el('div', { class: 'oh-burst-anchor', 'aria-hidden': 'true' });
      var card = hidden(U.el('div', { class: 'oh-card' },
        U.el('span', { class: 'oh-stars', title: 'Stars' }, NS.icons.render('star', { kind: 'ui', class: 'oh-star-icon' }), starCount),
        prompt, U.el('span', { class: 'oh-card-buttons' }, pick, hint, skip), burstLayer));

      function current() { return COLOR_CHALLENGES[s.index]; }
      function showChallenge() {
        var ch = current();
        prompt.textContent = challengeText(ch);
        pick.hidden = !ch.free;
        hint.hidden = !!ch.free;
        hint.disabled = false;
      }

      mixer.onChange(function (rgb) {
        if (s.hinting || s.busy) return;
        if (colorMatches(current(), rgb)) celebrate();
      });

      function celebrate() {
        if (s.busy) return;
        s.busy = true;
        clearTimeout(s.sayTimer);
        s.stars += 1;
        starCount.textContent = String(s.stars);
        NS.sound.play('tada');
        var ch = current();
        var rgb = mixer.get();
        var praise = ch.free ? 'What a lovely color!' : PRAISE[(s.stars - 1) % PRAISE.length] + " That's " + ch.name + '!';
        say(praise + ' Its secret code is ' + speakCode(rgb) + '.');
        card.classList.add('is-won');
        burst(burstLayer, live, 8).catch(noop);
        U.sleep(ch.free ? 4200 : 3000, signal).then(function () { advance(true); }, noop);
      }

      function advance(won) {
        s.busy = false;
        clearTimeout(s.sayTimer);
        card.classList.remove('is-won');
        s.index = nextChallenge(s.index, mixer.get());
        showChallenge();
        if (!won) NS.sound.play('click');
        A.pop(prompt, live).catch(noop);
        say(challengeText(current()));
      }

      // "Show me": the sliders mix the answer, then go back to the child's color.
      function showMe() {
        var ch = current();
        if (ch.free || s.hinting || s.busy) return;
        s.hinting = true;
        hint.disabled = true;
        var before = mixer.get();
        say('Like this! ' + ch.how);
        mixer.set(ch.show, live).then(function () {
          return A.highlight(mixer.swatch, live);
        }).then(function () { return U.sleep(1800, signal); }).then(function () {
          return mixer.set(before, live);
        }).then(function () {
          s.hinting = false;
          hint.disabled = false;
          say('Now you try!');
        }, noop);
      }

      var colorPanel = U.el('div', { class: 'oh-tab-panel oh-panel-colors' }, card, mixer.el);

      // --- Counter: decimal, octal and hex odometers that move together ---
      var odos = COUNTERS.map(function (c) {
        var odo = NS.odometer.create({ set: c.set, places: c.places, value: 0, labels: 'numbers' });
        return { odo: odo, base: odo.digitSet.base,
          box: U.el('div', { class: 'oh-odo theme-' + odo.digitSet.theme }, U.el('span', { class: 'oh-odo-name', text: c.name }), odo.el) };
      });
      var countButtons = [[-1, '−1', 'Count down one'], [1, '+1', 'Count up one'], [10, '+10', 'Add ten']].map(function (b) {
        return U.el('button', { type: 'button', class: ['btn', 'oh-count-btn', b[0] > 0 ? 'is-up' : ''], 'aria-label': b[2],
          dataset: { delta: String(b[0]) }, onClick: function () { go(b[0]); } }, b[1]);
      });
      var countStatus = U.el('p', { class: 'oh-count-status', 'aria-live': 'polite' });
      function drawCount() {
        countButtons[0].disabled = s.count <= 0;
        countButtons[1].disabled = countButtons[2].disabled = s.count >= COUNTER_MAX;
        countStatus.textContent = 'Decimal ' + s.count + ' = octal ' + s.count.toString(8) + ' = hex ' + s.count.toString(16).toUpperCase();
      }
      function go(delta) {
        var next = counterNext(s.count, delta);
        if (next === s.count) return;
        var from = s.count;
        s.count = next;
        var rolled = false;
        odos.forEach(function (o) {
          o.odo.set(next, live).catch(noop);
          if (changedPlaces(from, next, o.base) > 1 && Math.abs(delta) === 1) {
            rolled = true;
            A.highlight(o.box, live).catch(noop);
          }
        });
        NS.sound.play(rolled ? 'carry' : 'click');
        drawCount();
        sayLater(cap(words(next)) + '. Octal ' + D.speak(next, 'octal') + '. Hex ' + D.speak(next, 'hex') + '.', 700);
      }
      drawCount();
      var countPanel = U.el('div', { class: 'oh-tab-panel oh-panel-count', hidden: true },
        U.el('p', { class: 'oh-count-tip', text: 'Count up and watch each counter roll over: after 7 in octal, after F in hex!' }),
        U.el('div', { class: 'oh-odos' }, odos.map(function (o) { return o.box; })),
        U.el('div', { class: 'oh-count-buttons' }, countButtons), countStatus);

      // --- Tabs ---
      var tabs = {};
      function tab(kind, label, art) {
        tabs[kind] = U.el('button', { type: 'button', class: 'btn oh-tab', 'aria-pressed': 'false', onClick: function () { show(kind); } },
          art, U.el('span', { text: label }));
        return tabs[kind];
      }
      function show(kind) {
        colorPanel.hidden = kind !== 'colors';
        countPanel.hidden = kind !== 'count';
        Object.keys(tabs).forEach(function (k) { tabs[k].setAttribute('aria-pressed', String(k === kind)); });
      }
      var tabRow = U.el('div', { class: 'oh-tabs', role: 'group', 'aria-label': 'Choose a toy' },
        tab('colors', 'Colors', U.el('span', { class: 'oh-tab-dots', 'aria-hidden': 'true' }, U.el('i'), U.el('i'), U.el('i'))),
        tab('count', 'Counter', U.el('span', { class: 'oh-tab-glyph', 'aria-hidden': 'true', text: '7F' })));
      show('colors');
      showChallenge();

      stage.appendChild(U.el('div', { class: 'oh-scene oh-try' }, tabRow, colorPanel, countPanel));
      s.card = card;
      s.prompt = prompt;
      s.mixer = mixer;
      s.odos = odos;
      s.go = go;
      s.show = show;
      return s;
    },
    teardown: function (stage, ctx) {
      var s = ctx.state;
      clearTimeout(s.sayTimer);
      if (s.ctrl) s.ctrl.abort();
    },
    steps: [
      {
        say: 'Your turn! Move the red, green and blue sliders to mix a color. ' + challengeText(COLOR_CHALLENGES[0]) +
          ' You can also press Counter, to count in decimal, octal and hex all at once.',
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('pop');
          return A.pop(s.card, ctx).then(function () { return ctx.cue(2); }).then(function () {
            return A.parallel(A.highlight(s.card, ctx), A.bounce(s.prompt, ctx));
          });
        }
      }
    ]
  };

  NS.lessons.register({
    id: 'octal-hex',
    order: 30,
    title: 'Octal & Hexadecimal',
    shortTitle: 'Octal & Hex',
    blurb: 'Eight-fingered aliens, sixteen digits, and secret color codes.',
    ageHint: '8+',
    theme: 'hex',
    icon: 'hands',
    glyph: '7F',
    scenes: [anyBase, hexDigits, friends, colors, tryIt],
    // Pure helpers, exposed for unit tests.
    helpers: {
      TOLERANCE: TOLERANCE, COLOR_CHALLENGES: COLOR_CHALLENGES, COUNTER_MAX: COUNTER_MAX, STEP: STEP,
      ALL_TEN: ALL_TEN, BYTE: BYTE, OCT_FROM: OCT_FROM, OCT_TO: OCT_TO, HEX_FROM: HEX_FROM, HEX_TO: HEX_TO, DEMO_COLORS: DEMO_COLORS,
      hex2: hex2, rgbToCode: rgbToCode, codeToRgb: codeToRgb, speakPair: speakPair, speakCode: speakCode,
      colorDistance: colorDistance, isPurple: isPurple, colorMatches: colorMatches, challengeText: challengeText,
      nextChallenge: nextChallenge, stepChannel: stepChannel, counterNext: counterNext, changedPlaces: changedPlaces,
      nibbles: nibbles, nibbleHex: nibbleHex
    }
  });
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
