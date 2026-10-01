// Cartoon hands (inline SVG), the star of the base-10 and binary lessons.
//
// Drawn as you look at the BACKS of your own hands (DECISIONS D5): left hand on the left,
// right hand on the right, thumbs in the middle. "Display order" is left to right across the
// screen: left pinky, left ring, left middle, left index, left thumb, right thumb, right index,
// right middle, right ring, right pinky. Bit values run right to left like a written number:
// right pinky = 1 ... left pinky = 512, so the fingers read like the binary digits of n.
//
//   var h = NS.hands.create({hands: 'both' | 'left' | 'right', labels: false, skin: 'tan'});
//   h.setFingers(3, ctx)          base-10 counting: the first 3 fingers (left to right) go up
//   h.setBits(11, ctx)            binary: right pinky, ring and index up (8 + 2 + 1)
//   h.setFinger('left', 'thumb', true, ctx)
//   h.labels(true, values?, ctx)  value badges above the fingers (default 512 ... 1)
//   var off = h.onToggle(function (info) { ... })   clickable fingers; off() disables
//   h.wave(ctx); h.glow(ctx)
//
// Layout decision (narrow screens): the hands never stack. The SVG always shows both hands
// side by side and scales with its container, so the fingers keep reading as one binary
// number from left to right. At 400px wide each finger is still about 20px wide.
//
// The pure helpers (bitsToFingers, countToFingers, fingerValues, ...) are unit-tested in Node.
(function (NS) {
  'use strict';

  var FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

  // ---------- Pure logic ----------

  // [{hand, finger}] in display order (left to right on screen).
  function displayOrder(mode) {
    var left = FINGERS.slice().reverse().map(function (f) { return { hand: 'left', finger: f }; });
    var right = FINGERS.map(function (f) { return { hand: 'right', finger: f }; });
    if (mode === 'left') return left;
    if (mode === 'right') return right;
    return left.concat(right);
  }

  function fingerCount(mode) { return mode === 'left' || mode === 'right' ? 5 : 10; }

  // Value of each finger in display order: fingerValues(10) -> [512, 256, ..., 2, 1].
  function fingerValues(count) {
    count = count || 10;
    var out = [];
    for (var i = 0; i < count; i++) out.push(Math.pow(2, count - 1 - i));
    return out;
  }

  // bitsToFingers(11) -> 10 booleans in display order (true = finger up).
  function bitsToFingers(n, count) {
    count = count || 10;
    var max = Math.pow(2, count) - 1;
    if (!Number.isInteger(n) || n < 0 || n > max) {
      throw new RangeError(count + ' fingers can show 0 to ' + max + ' (got ' + n + ')');
    }
    var out = [];
    for (var i = 0; i < count; i++) out.push(Math.floor(n / Math.pow(2, count - 1 - i)) % 2 === 1);
    return out;
  }

  function fingersToBits(fingers) {
    return fingers.reduce(function (acc, up) { return acc * 2 + (up ? 1 : 0); }, 0);
  }

  // Base-10 counting: the first `k` fingers from the left are up.
  function countToFingers(k, count) {
    count = count || 10;
    if (!Number.isInteger(k) || k < 0 || k > count) {
      throw new RangeError(count + ' fingers can count 0 to ' + count + ' (got ' + k + ')');
    }
    var out = [];
    for (var i = 0; i < count; i++) out.push(i < k);
    return out;
  }

  // Display index of a finger, or -1 if that hand is not shown.
  function fingerIndex(hand, finger, mode) {
    var order = displayOrder(mode || 'both');
    for (var i = 0; i < order.length; i++) {
      if (order[i].hand === hand && order[i].finger === finger) return i;
    }
    return -1;
  }

  function fingerName(hand, finger) { return hand + ' ' + finger; }

  // ---------- Skin tones ----------

  var SKIN_TONES = [
    { id: 'light', name: 'Light', fill: '#ffdcbd', line: '#c98b62', nail: '#fff1e6' },
    { id: 'medium-light', name: 'Medium light', fill: '#eeb98f', line: '#b07a52', nail: '#fadfca' },
    { id: 'medium', name: 'Medium', fill: '#c99566', line: '#8a5f3c', nail: '#ecc9a8' },
    { id: 'medium-dark', name: 'Medium dark', fill: '#9a643f', line: '#5c381e', nail: '#cfa385' },
    { id: 'dark', name: 'Dark', fill: '#6b4128', line: '#33190a', nail: '#a77d63' }
  ];
  var DEFAULT_SKIN = 'medium-light';

  function skinTone(id) {
    for (var i = 0; i < SKIN_TONES.length; i++) if (SKIN_TONES[i].id === id) return SKIN_TONES[i];
    return null;
  }
  function getSkinTone() {
    var id = NS.util.storage.get('hands.skin', DEFAULT_SKIN);
    return skinTone(id) ? id : DEFAULT_SKIN;
  }

  var live = []; // instances following the saved skin tone

  function applySkin(el, id) {
    var t = skinTone(id) || skinTone(DEFAULT_SKIN);
    el.style.setProperty('--skin', t.fill);
    el.style.setProperty('--skin-line', t.line);
    el.style.setProperty('--nail', t.nail);
    el.dataset.skin = t.id;
  }

  // Save the skin tone (localStorage) and update every hand on screen that follows it.
  function setSkinTone(id) {
    if (!skinTone(id)) throw new Error('Unknown skin tone: ' + id);
    NS.util.storage.set('hands.skin', id);
    live = live.filter(function (inst) { return inst.el.isConnected; });
    live.forEach(function (inst) { applySkin(inst.el, id); });
    return id;
  }

  // A row of round swatches (for a settings panel or the gallery).
  function skinPicker(onChange) {
    var U = NS.util;
    var current = getSkinTone();
    var buttons = SKIN_TONES.map(function (t) {
      return U.el('button', {
        type: 'button', class: 'skin-swatch', title: t.name, 'aria-label': t.name + ' skin',
        'aria-pressed': String(t.id === current), style: { background: t.fill, borderColor: t.line },
        onClick: function () {
          setSkinTone(t.id);
          buttons.forEach(function (b, i) { b.setAttribute('aria-pressed', String(SKIN_TONES[i].id === t.id)); });
          if (onChange) onChange(t.id);
        }
      });
    });
    return U.el('div', { class: 'skin-picker', role: 'group', 'aria-label': 'Hand color' }, buttons);
  }

  // ---------- Drawing ----------
  // One RIGHT hand in local coordinates (200 x 250, thumb on the left); the left hand is a mirror.
  var HAND_W = 200, HAND_H = 250, GAP = 36, LABEL_H = 40;
  var GEOM = {
    thumb: { x: 60, y: 178, angle: -52, len: 64, w: 30, labelX: 18 },
    index: { x: 77, y: 124, angle: -7, len: 92, w: 27, labelX: 59 },
    middle: { x: 104, y: 118, angle: 0, len: 104, w: 28, labelX: 101 },
    ring: { x: 130, y: 122, angle: 6, len: 94, w: 26, labelX: 146 },
    pinky: { x: 153, y: 134, angle: 15, len: 72, w: 22, labelX: 190 }
  };
  var POSE = {
    finger: { up: 'scale(1, 1)', down: 'scale(1, 0.36)', stretch: 'scale(0.92, 1.08)', squash: 'scale(1.1, 0.3)' },
    thumb: { up: 'rotate(0deg) scale(1, 1)', down: 'rotate(68deg) scale(1, 0.62)',
      stretch: 'rotate(-6deg) scale(0.95, 1.06)', squash: 'rotate(74deg) scale(1.08, 0.56)' }
  };
  function poseOf(finger) { return finger === 'thumb' ? POSE.thumb : POSE.finger; }

  function drawFinger(U, name) {
    var g = GEOM[name];
    var w = g.w, len = g.len;
    var nailW = w - 10;
    var flex = U.svg('g', { class: 'hand-flex' },
      U.svg('rect', { class: 'hand-skin', x: -w / 2, y: -len, width: w, height: len + 16, rx: w / 2, 'stroke-width': 4 }),
      U.svg('rect', { class: 'hand-nail', x: -nailW / 2, y: -len + 5, width: nailW, height: nailW * 1.15, rx: nailW / 2.3 }),
      U.svg('path', { class: 'hand-crease', d: 'M' + (-w / 4) + ' ' + (-len * 0.5) + ' q' + (w / 4) + ' 3 ' + (w / 2) + ' 0' +
        ' M' + (-w / 4) + ' ' + (-len * 0.22) + ' q' + (w / 4) + ' 3 ' + (w / 2) + ' 0' }));
    var hit = U.svg('rect', { class: 'hand-hit', x: -w / 2 - 6, y: -len - 8, width: w + 12, height: len + 22, rx: 10 });
    var outer = U.svg('g', { class: 'hand-finger finger-' + name, transform: 'translate(' + g.x + ' ' + g.y + ') rotate(' + g.angle + ')' },
      hit, flex);
    return { outer: outer, flex: flex };
  }

  function drawHand(U, side) {
    var parts = {};
    var mirror = U.svg('g', side === 'left' ? { transform: 'translate(' + HAND_W + ' 0) scale(-1 1)' } : {});
    ['index', 'middle', 'ring', 'pinky'].forEach(function (f) {
      parts[f] = drawFinger(U, f);
      mirror.appendChild(parts[f].outer);
    });
    mirror.appendChild(U.svg('path', { class: 'hand-skin hand-palm', 'stroke-width': 4,
      d: 'M60 130 Q60 110 80 109 L150 111 Q171 115 169 142 L165 196 Q161 222 135 226 L86 226 Q60 222 57 196 Z' }));
    mirror.appendChild(U.svg('path', { class: 'hand-crease', d: 'M86 150 q8 4 16 0 M114 150 q8 4 16 0' }));
    parts.thumb = drawFinger(U, 'thumb');
    mirror.appendChild(parts.thumb.outer);
    mirror.appendChild(U.svg('rect', { class: 'hand-sleeve', x: 70, y: 214, width: 92, height: 36, rx: 12 }));
    var wave = U.svg('g', { class: 'hand-wave' }, mirror);
    return { group: wave, parts: parts };
  }

  // ---------- Component ----------

  function create(opts) {
    var U = NS.util, A = NS.anim;
    opts = opts || {};
    var mode = opts.hands === 'left' || opts.hands === 'right' ? opts.hands : 'both';
    var order = displayOrder(mode);
    var count = order.length;
    var sides = mode === 'both' ? ['left', 'right'] : [mode];
    var width = sides.length * HAND_W + (sides.length - 1) * GAP;

    var svgEl = U.svg('svg', {
      class: 'hands-svg', viewBox: '-12 0 ' + (width + 24) + ' ' + (HAND_H + LABEL_H),
      role: 'img', focusable: 'false', preserveAspectRatio: 'xMidYMid meet'
    });
    var el = U.el('div', { class: ['hands', 'hands-' + mode, opts.class] }, svgEl);
    if (opts.skin) applySkin(el, opts.skin);
    else { applySkin(el, getSkinTone()); live.push({ el: el }); }

    var fingers = []; // display order: {hand, finger, outer, flex, badge, up}
    var hands = {};
    sides.forEach(function (side, si) {
      var hand = drawHand(U, side);
      var offset = si * (HAND_W + GAP);
      svgEl.appendChild(U.svg('g', { transform: 'translate(' + offset + ' ' + LABEL_H + ')' }, hand.group));
      hands[side] = { group: hand.group, parts: hand.parts, offset: offset };
    });

    var badgeLayer = U.svg('g', { class: 'hand-badges' });
    svgEl.appendChild(badgeLayer);
    order.forEach(function (pos, i) {
      var part = hands[pos.hand].parts[pos.finger];
      var lx = GEOM[pos.finger].labelX;
      if (pos.hand === 'left') lx = HAND_W - lx;
      lx += hands[pos.hand].offset;
      var text = U.svg('text', { x: 0, y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'hand-badge-text' }, '');
      var rect = U.svg('rect', { class: 'hand-badge-bg', x: -18, y: -14, width: 36, height: 28, rx: 14 });
      var badge = U.svg('g', { class: 'hand-badge', transform: 'translate(' + lx + ' 18)' },
        U.svg('g', { class: 'hand-badge-pop' }, rect, text));
      badge.style.display = 'none';
      badgeLayer.appendChild(badge);
      fingers.push({ hand: pos.hand, finger: pos.finger, outer: part.outer, flex: part.flex, badge: badge,
        badgeText: text, badgeRect: rect, up: true, value: Math.pow(2, count - 1 - i) });
    });

    var labelsOn = false;
    var toggleCb = null;

    function describe() {
      var up = fingers.filter(function (f) { return f.up; });
      var what = mode === 'both' ? 'Two hands' : (mode === 'left' ? 'A left hand' : 'A right hand');
      var label = what + ', ' + up.length + (up.length === 1 ? ' finger up' : ' fingers up') +
        (up.length && up.length < count ? ': ' + up.map(function (f) { return fingerName(f.hand, f.finger); }).join(', ') : '');
      svgEl.setAttribute('aria-label', label);
      fingers.forEach(function (f) {
        f.outer.classList.toggle('is-down', !f.up);
        f.badge.classList.toggle('is-on', f.up);
        if (toggleCb) f.outer.setAttribute('aria-pressed', String(f.up));
      });
    }

    function snap(f) { f.flex.style.transform = f.up ? poseOf(f.finger).up : poseOf(f.finger).down; }

    // Move one finger (by display index) with squash and stretch.
    function moveFinger(i, up, ctx) {
      var f = fingers[i];
      if (!f) throw new RangeError('No finger at index ' + i);
      if (f.up === up) return Promise.resolve();
      f.up = up;
      describe();
      var p = poseOf(f.finger);
      var kf = up
        ? [{ transform: p.down }, { transform: p.stretch, offset: 0.6 }, { transform: p.up }]
        : [{ transform: p.up }, { transform: p.squash, offset: 0.7 }, { transform: p.down }];
      return A.run(f.flex, kf, { duration: 380, easing: 'ease-out' }, ctx);
    }

    // Set all fingers to a list of booleans (display order); changed fingers move one after another.
    function setAll(states, ctx) {
      if (states.length !== count) throw new RangeError('Expected ' + count + ' finger states');
      var changed = [];
      states.forEach(function (up, i) { if (fingers[i].up !== !!up) changed.push(i); });
      // Right to left, like counting up from the ones finger.
      changed.reverse();
      return A.stagger(changed, function (i) { return moveFinger(i, !!states[i], ctx); }, 70, ctx);
    }

    function setLabelValues(values) {
      fingers.forEach(function (f, i) {
        var v = values ? values[i] : f.value;
        var s = v === undefined || v === null ? '' : String(v);
        f.badgeText.textContent = s;
        var w = Math.max(28, s.length * 9.4 + 9); // 3 digits (~38) fit the ~42-unit label spacing
        f.badgeRect.setAttribute('x', -w / 2);
        f.badgeRect.setAttribute('width', w);
      });
    }

    function activate(f, i) {
      var ctx = { speed: 1, reducedMotion: U.prefersReducedMotion() };
      moveFinger(i, !f.up, ctx).catch(function () {});
      if (NS.sound) NS.sound.play(f.up ? 'pop' : 'click');
      if (toggleCb) {
        toggleCb({ index: i, hand: f.hand, finger: f.finger, up: f.up, value: f.value,
          bits: api.getBits(), count: api.getFingers().filter(Boolean).length });
      }
    }

    fingers.forEach(function (f, i) {
      f.outer.addEventListener('click', function () { if (toggleCb) activate(f, i); });
      f.outer.addEventListener('keydown', function (e) {
        if (!toggleCb) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(f, i); }
      });
    });

    var api = {
      el: el,
      svg: svgEl,
      mode: mode,
      count: count,
      order: order,
      getFingers: function () { return fingers.map(function (f) { return f.up; }); },
      getBits: function () { return fingersToBits(api.getFingers()); },
      // Base-10 counting: the first k fingers from the left go up.
      setFingers: function (k, ctx) { return setAll(countToFingers(k, count), ctx); },
      // Binary: show n with the D5 mapping (rightmost finger = 1).
      setBits: function (n, ctx) { return setAll(bitsToFingers(n, count), ctx); },
      setStates: function (states, ctx) { return setAll(states, ctx); },
      setFinger: function (hand, finger, up, ctx) {
        var i = fingerIndex(hand, finger, mode);
        if (i < 0) throw new Error('The ' + hand + ' hand is not shown');
        return moveFinger(i, !!up, ctx);
      },
      fingerAt: function (i) { return fingers[i]; },
      // Value badges above the fingers. values: array in display order (default 512 ... 1).
      labels: function (on, values, ctx) {
        labelsOn = !!on;
        el.classList.toggle('has-labels', labelsOn);
        if (labelsOn) setLabelValues(values);
        if (!labelsOn) {
          fingers.forEach(function (f) { f.badge.style.display = 'none'; });
          return Promise.resolve();
        }
        // Pop in right to left (ones first).
        var list = fingers.slice().reverse();
        list.forEach(function (f) { f.badge.style.display = ''; });
        return A.stagger(list, function (f) {
          return A.pop(f.badge.firstChild, ctx);
        }, 60, ctx);
      },
      // Clickable fingers for interactive scenes. Returns a function that turns it off.
      onToggle: function (cb) {
        toggleCb = cb;
        el.classList.add('is-interactive');
        svgEl.setAttribute('role', 'group');
        fingers.forEach(function (f) {
          f.outer.setAttribute('tabindex', '0');
          f.outer.setAttribute('role', 'button');
          f.outer.setAttribute('aria-label', fingerName(f.hand, f.finger) + (labelsOn ? ', worth ' + f.value : ''));
        });
        describe();
        return function off() {
          if (toggleCb !== cb) return;
          toggleCb = null;
          el.classList.remove('is-interactive');
          svgEl.setAttribute('role', 'img');
          fingers.forEach(function (f) {
            ['tabindex', 'role', 'aria-label', 'aria-pressed'].forEach(function (a) { f.outer.removeAttribute(a); });
          });
        };
      },
      wave: function (ctx) {
        return A.parallel.apply(null, sides.map(function (side, i) {
          var dir = side === 'left' ? -1 : 1;
          return A.run(hands[side].group, [
            { transform: 'rotate(0deg)' }, { transform: 'rotate(' + (10 * dir) + 'deg)' },
            { transform: 'rotate(' + (-8 * dir) + 'deg)' }, { transform: 'rotate(' + (6 * dir) + 'deg)' },
            { transform: 'rotate(0deg)' }
          ], { duration: 1100, easing: 'ease-in-out', delay: i * 80 }, ctx, 'transient');
        }));
      },
      // Make the raised fingers (or the given display indexes) glow for a moment.
      glow: function (ctx, indexes) {
        ctx = ctx || {};
        if (ctx.instant) return Promise.resolve();
        var list = indexes ? indexes.map(function (i) { return fingers[i]; })
                           : fingers.filter(function (f) { return f.up; });
        list.forEach(function (f) { f.outer.classList.add('is-glowing'); });
        var done = function () { list.forEach(function (f) { f.outer.classList.remove('is-glowing'); }); };
        return A.wait(1100, ctx).then(done, function (e) { done(); throw e; });
      },
      setSkin: function (id) { live = live.filter(function (x) { return x.el !== el; }); applySkin(el, id); },
      destroy: function () {
        live = live.filter(function (x) { return x.el !== el; });
        toggleCb = null;
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    };

    // Initial pose: all up unless told otherwise.
    var initial = opts.bits !== undefined ? bitsToFingers(opts.bits, count)
      : opts.fingers !== undefined ? countToFingers(opts.fingers, count)
      : countToFingers(count, count);
    fingers.forEach(function (f, i) { f.up = initial[i]; snap(f); });
    describe();
    if (opts.labels) api.labels(true, opts.labelValues, { instant: true });
    return api;
  }

  NS.hands = {
    FINGERS: FINGERS,
    SKIN_TONES: SKIN_TONES,
    displayOrder: displayOrder,
    fingerCount: fingerCount,
    fingerValues: fingerValues,
    bitsToFingers: bitsToFingers,
    fingersToBits: fingersToBits,
    countToFingers: countToFingers,
    fingerIndex: fingerIndex,
    getSkinTone: getSkinTone,
    setSkinTone: setSkinTone,
    skinPicker: skinPicker,
    create: create
  };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
