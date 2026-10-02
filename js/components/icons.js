// Original inline SVG icons (DECISIONS D6: no emoji, no external assets).
// Icons are plain data (lists of [tag, attrs, children]) so this file loads in Node;
// render() turns them into SVG elements.
//
//   NS.icons.render('cat', {size: 64, title: 'Cat'})     -> <svg class="icon-art icon-cat">
//   NS.icons.render('triangle', {color: '#fbc02d'})      -> a filled shape
//   NS.icons.render('play')                              -> UI icon (24x24, currentColor)
//   NS.icons.names('art' | 'shape' | 'ui')               -> list of names
//
// Style: thick dark outlines, flat fills, 100x100 viewBox for art and shapes.
(function (NS) {
  'use strict';

  var INK = '#2b2d42';
  var SW = 4; // outline width

  function o(attrs) { // outlined shape attrs
    return Object.assign({ stroke: INK, 'stroke-width': SW, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, attrs);
  }
  function line(d, w) {
    return ['path', { d: d, fill: 'none', stroke: INK, 'stroke-width': w || SW, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }];
  }
  function dot(cx, cy, r, fill) { return ['circle', { cx: cx, cy: cy, r: r, fill: fill || INK }]; }
  function shine(cx, cy) { return dot(cx, cy, 1.6, '#fff'); }
  function eyes(y, dx, r) {
    r = r || 4.5;
    return [dot(50 - dx, y, r), dot(50 + dx, y, r), shine(50 - dx + 1.5, y - 1.5), shine(50 + dx + 1.5, y - 1.5)];
  }

  function starPath(cx, cy, R, r, points) {
    var d = '';
    for (var i = 0; i < points * 2; i++) {
      var rad = i % 2 ? r : R;
      var a = Math.PI / points * i - Math.PI / 2;
      d += (i ? 'L' : 'M') + (cx + rad * Math.cos(a)).toFixed(1) + ' ' + (cy + rad * Math.sin(a)).toFixed(1);
    }
    return d + 'Z';
  }

  // ---------- Animals and objects (100x100) ----------
  var ART = {
    cat: {
      label: 'Cat',
      nodes: [
        ['path', o({ d: 'M24 44 L26 12 L48 30 Z', fill: '#f4a340' })],
        ['path', o({ d: 'M76 44 L74 12 L52 30 Z', fill: '#f4a340' })],
        ['path', { d: 'M29 34 L30 20 L40 29 Z', fill: '#f7b6c2' }],
        ['path', { d: 'M71 34 L70 20 L60 29 Z', fill: '#f7b6c2' }],
        ['ellipse', o({ cx: 50, cy: 57, rx: 32, ry: 29, fill: '#f4a340' })],
        ['path', { d: 'M44 30 Q50 36 56 30', fill: 'none', stroke: '#d9822b', 'stroke-width': 3, 'stroke-linecap': 'round' }]
      ].concat(eyes(52, 12), [
        ['path', { d: 'M45 62 H55 L50 67.5 Z', fill: '#f2799a', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }],
        line('M50 67.5 Q45 75 39 71 M50 67.5 Q55 75 61 71', 3),
        line('M22 60 L36 62 M22 68 L36 66 M78 60 L64 62 M78 68 L64 66', 2.5)
      ])
    },
    dog: {
      label: 'Dog',
      nodes: [
        ['ellipse', o({ cx: 50, cy: 55, rx: 28, ry: 30, fill: '#d9a066' })],
        ['path', o({ d: 'M27 32 Q9 36 12 64 Q22 72 30 58 Z', fill: '#7a4b2a' })],
        ['path', o({ d: 'M73 32 Q91 36 88 64 Q78 72 70 58 Z', fill: '#7a4b2a' })],
        ['ellipse', { cx: 61, cy: 46, rx: 9, ry: 8, fill: '#7a4b2a', opacity: 0.85 }]
      ].concat(eyes(47, 10), [
        ['ellipse', o({ cx: 50, cy: 68, rx: 15, ry: 11, fill: '#f6e2c6', 'stroke-width': 3 })],
        ['ellipse', { cx: 50, cy: 62, rx: 6.5, ry: 4.5, fill: INK }],
        ['path', { d: 'M46 72 Q50 82 54 72 Z', fill: '#f2799a', stroke: INK, 'stroke-width': 2 }],
        line('M50 66 V71 M43 71 Q50 75 57 71', 2.5)
      ])
    },
    frog: {
      label: 'Frog',
      nodes: [
        ['circle', o({ cx: 32, cy: 36, r: 13, fill: '#5cb85c' })],
        ['circle', o({ cx: 68, cy: 36, r: 13, fill: '#5cb85c' })],
        ['ellipse', o({ cx: 50, cy: 62, rx: 38, ry: 25, fill: '#5cb85c' })],
        ['circle', { cx: 32, cy: 36, r: 8, fill: '#fff' }],
        ['circle', { cx: 68, cy: 36, r: 8, fill: '#fff' }],
        dot(33, 37, 4), dot(67, 37, 4), shine(34.5, 35.5), shine(68.5, 35.5),
        ['circle', { cx: 26, cy: 66, r: 5, fill: '#f7a1b5', opacity: 0.8 }],
        ['circle', { cx: 74, cy: 66, r: 5, fill: '#f7a1b5', opacity: 0.8 }],
        dot(45, 53, 1.8), dot(55, 53, 1.8),
        line('M30 62 Q50 80 70 62', 3.5)
      ]
    },
    pig: {
      label: 'Pig',
      nodes: [
        ['path', o({ d: 'M26 38 L22 14 L44 28 Z', fill: '#f6a5c0' })],
        ['path', o({ d: 'M74 38 L78 14 L56 28 Z', fill: '#f6a5c0' })],
        ['circle', o({ cx: 50, cy: 56, r: 31, fill: '#f6a5c0' })]
      ].concat(eyes(47, 12), [
        ['ellipse', o({ cx: 50, cy: 65, rx: 14, ry: 10, fill: '#f28cab', 'stroke-width': 3 })],
        ['ellipse', { cx: 45, cy: 65, rx: 2.6, ry: 3.8, fill: INK }],
        ['ellipse', { cx: 55, cy: 65, rx: 2.6, ry: 3.8, fill: INK }],
        ['circle', { cx: 28, cy: 62, r: 4.5, fill: '#f2799a', opacity: 0.6 }],
        ['circle', { cx: 72, cy: 62, r: 4.5, fill: '#f2799a', opacity: 0.6 }]
      ])
    },
    duck: {
      label: 'Duck',
      nodes: [
        ['ellipse', o({ cx: 50, cy: 82, rx: 30, ry: 14, fill: '#ffd23f' })],
        ['circle', o({ cx: 50, cy: 46, r: 28, fill: '#ffd23f' })],
        line('M50 18 Q45 8 52 6 M50 18 Q58 9 63 13', 3.5)
      ].concat(eyes(41, 10), [
        ['path', o({ d: 'M30 59 Q50 49 70 59 Q50 75 30 59 Z', fill: '#f7931e', 'stroke-width': 3.5 })],
        line('M33 59 Q50 63 67 59', 2.5),
        ['circle', { cx: 30, cy: 50, r: 4, fill: '#f7a1b5', opacity: 0.7 }],
        ['circle', { cx: 70, cy: 50, r: 4, fill: '#f7a1b5', opacity: 0.7 }]
      ])
    },
    cow: {
      label: 'Cow',
      nodes: [
        ['path', o({ d: 'M28 28 Q20 14 26 8 Q30 18 36 24 Z', fill: '#f2e3c4' })],
        ['path', o({ d: 'M72 28 Q80 14 74 8 Q70 18 64 24 Z', fill: '#f2e3c4' })],
        ['ellipse', o({ cx: 18, cy: 40, rx: 11, ry: 6, fill: '#fff', transform: 'rotate(-20 18 40)' })],
        ['ellipse', o({ cx: 82, cy: 40, rx: 11, ry: 6, fill: '#fff', transform: 'rotate(20 82 40)' })],
        ['ellipse', o({ cx: 50, cy: 48, rx: 27, ry: 30, fill: '#fff' })],
        ['path', { d: 'M30 32 Q38 26 44 34 Q40 44 30 42 Z', fill: INK }],
        ['path', { d: 'M62 54 Q72 50 75 58 Q70 64 62 62 Z', fill: INK }]
      ].concat(eyes(46, 11), [
        ['ellipse', o({ cx: 50, cy: 72, rx: 20, ry: 13, fill: '#f7b6c2' })],
        ['ellipse', { cx: 43, cy: 71, rx: 3, ry: 4, fill: INK }],
        ['ellipse', { cx: 57, cy: 71, rx: 3, ry: 4, fill: INK }]
      ])
    },
    owl: {
      label: 'Owl',
      nodes: [
        ['path', o({ d: 'M24 34 L20 10 L40 24 Z', fill: '#8d6e63' })],
        ['path', o({ d: 'M76 34 L80 10 L60 24 Z', fill: '#8d6e63' })],
        ['ellipse', o({ cx: 50, cy: 56, rx: 31, ry: 36, fill: '#8d6e63' })],
        ['ellipse', { cx: 50, cy: 72, rx: 18, ry: 17, fill: '#d7c2a8' }],
        line('M43 68 l3 3 3-3 M51 68 l3 3 3-3 M47 76 l3 3 3-3', 2),
        ['circle', o({ cx: 37, cy: 44, r: 12, fill: '#fff', 'stroke-width': 3 })],
        ['circle', o({ cx: 63, cy: 44, r: 12, fill: '#fff', 'stroke-width': 3 })],
        dot(38, 45, 5.5), dot(62, 45, 5.5), shine(40, 43), shine(64, 43),
        ['path', o({ d: 'M45 54 L55 54 L50 63 Z', fill: '#f7931e', 'stroke-width': 2.5 })]
      ]
    },
    fish: {
      label: 'Fish',
      nodes: [
        ['path', o({ d: 'M70 50 L94 30 L90 50 L94 70 Z', fill: '#1e88e5' })],
        ['ellipse', o({ cx: 44, cy: 50, rx: 32, ry: 22, fill: '#42a5f5' })],
        ['path', o({ d: 'M40 29 Q50 14 62 30', fill: '#1e88e5', 'stroke-width': 3.5 })],
        line('M50 38 Q56 50 50 62', 3),
        dot(28, 46, 4.5), shine(29.5, 44.5),
        line('M13 55 Q17 58 21 55', 2.5),
        ['circle', { cx: 38, cy: 58, r: 3, fill: '#bbdefb' }], ['circle', { cx: 58, cy: 46, r: 3, fill: '#bbdefb' }]
      ]
    },
    bee: {
      label: 'Bee',
      nodes: [
        line('M40 36 Q34 22 28 20 M54 36 Q58 22 66 20', 3),
        dot(28, 20, 3.5), dot(66, 20, 3.5),
        ['path', o({ d: 'M80 56 L94 56 L80 62 Z', fill: INK })],
        ['ellipse', { cx: 50, cy: 58, rx: 32, ry: 23, fill: '#ffd23f' }],
        ['path', { d: 'M46 36 V80 M62 38 V78', stroke: INK, 'stroke-width': 8, fill: 'none' }],
        ['ellipse', o({ cx: 50, cy: 58, rx: 32, ry: 23, fill: 'none' })],
        ['ellipse', o({ cx: 46, cy: 30, rx: 12, ry: 15, fill: '#e3f2fd', opacity: 0.9, 'stroke-width': 3, transform: 'rotate(-25 46 30)' })],
        ['ellipse', o({ cx: 64, cy: 30, rx: 10, ry: 13, fill: '#e3f2fd', opacity: 0.9, 'stroke-width': 3, transform: 'rotate(20 64 30)' })],
        dot(30, 54, 4), shine(31.5, 52.5),
        line('M26 64 Q30 67 34 64', 2.5)
      ]
    },
    snail: {
      label: 'Snail',
      nodes: [
        line('M22 58 L16 34 M30 58 L28 32', 3),
        dot(16, 33, 4), dot(28, 31, 4),
        ['path', o({ d: 'M10 80 Q10 58 24 56 Q34 56 36 70 L86 70 Q94 72 90 80 Z', fill: '#c5d86d' })],
        ['circle', o({ cx: 60, cy: 48, r: 24, fill: '#e5a663' })],
        line('M60 48 m0 -4 a4 4 0 1 1 -4 4 a8 8 0 1 1 8 8 a12 12 0 1 1 -12 -12 a16 16 0 1 1 16 16', 3),
        line('M18 66 Q22 69 26 66', 2.5)
      ]
    },
    unicorn: {
      label: 'Unicorn',
      nodes: [
        ['circle', o({ cx: 28, cy: 30, r: 10, fill: '#f48fb1', 'stroke-width': 3 })],
        ['circle', o({ cx: 72, cy: 30, r: 10, fill: '#b39ddb', 'stroke-width': 3 })],
        ['circle', o({ cx: 24, cy: 48, r: 9, fill: '#81d4fa', 'stroke-width': 3 })],
        ['circle', o({ cx: 76, cy: 48, r: 9, fill: '#f48fb1', 'stroke-width': 3 })],
        ['path', o({ d: 'M34 30 L32 16 L44 24 Z', fill: '#fff' })],
        ['path', o({ d: 'M66 30 L68 16 L56 24 Z', fill: '#fff' })],
        ['ellipse', o({ cx: 50, cy: 56, rx: 24, ry: 30, fill: '#fff' })],
        ['path', o({ d: 'M50 4 L43 30 L57 30 Z', fill: '#ffd23f', 'stroke-width': 3.5 })],
        line('M45.5 21 L54 18 M47 14 L52.5 12', 2.5),
        line('M36 50 Q40 46 44 50 M56 50 Q60 46 64 50', 3),
        ['ellipse', o({ cx: 50, cy: 74, rx: 15, ry: 10, fill: '#f8bbd0', 'stroke-width': 3 })],
        dot(45, 74, 2), dot(55, 74, 2),
        ['circle', { cx: 34, cy: 60, r: 4, fill: '#f48fb1', opacity: 0.6 }],
        ['circle', { cx: 66, cy: 60, r: 4, fill: '#f48fb1', opacity: 0.6 }]
      ]
    },
    robot: {
      label: 'Robot',
      nodes: [
        line('M50 22 V10', 3.5),
        ['circle', o({ cx: 50, cy: 9, r: 5, fill: '#e53935', 'stroke-width': 3 })],
        ['rect', o({ x: 10, y: 42, width: 10, height: 20, rx: 3, fill: '#78909c' })],
        ['rect', o({ x: 80, y: 42, width: 10, height: 20, rx: 3, fill: '#78909c' })],
        ['rect', o({ x: 18, y: 22, width: 64, height: 60, rx: 14, fill: '#b0bec5' })],
        ['circle', o({ cx: 36, cy: 46, r: 9, fill: '#fff', 'stroke-width': 3 })],
        ['circle', o({ cx: 64, cy: 46, r: 9, fill: '#fff', 'stroke-width': 3 })],
        dot(36, 46, 4.5, '#1e88e5'), dot(64, 46, 4.5, '#1e88e5'),
        ['rect', o({ x: 32, y: 62, width: 36, height: 10, rx: 4, fill: '#eceff1', 'stroke-width': 3 })],
        line('M41 62 V72 M50 62 V72 M59 62 V72', 2.5)
      ]
    },
    star: {
      label: 'Star',
      nodes: [
        ['path', o({ d: starPath(50, 53, 44, 19, 5), fill: '#ffd23f' })],
        dot(42, 52, 3.5), dot(58, 52, 3.5), line('M44 61 Q50 66 56 61', 2.5)
      ]
    },
    heart: {
      label: 'Heart',
      nodes: [
        ['path', o({ d: 'M50 86 C22 66 8 48 17 31 C26 15 45 18 50 33 C55 18 74 15 83 31 C92 48 78 66 50 86 Z', fill: '#e53950' })],
        ['path', { d: 'M27 32 Q30 26 36 26', fill: 'none', stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.7 }]
      ]
    },
    banana: {
      label: 'Banana',
      nodes: [
        ['path', o({ d: 'M22 26 Q18 74 66 82 Q84 84 90 74 Q84 72 74 72 Q40 68 34 26 Z', fill: '#ffe066' })],
        line('M30 34 Q30 66 70 76', 2.5),
        ['path', o({ d: 'M22 26 L20 16 L32 16 L34 26 Z', fill: '#8d6e63', 'stroke-width': 3 })]
      ]
    },
    rocket: {
      label: 'Rocket',
      nodes: [
        ['path', o({ d: 'M41 70 Q50 98 59 70 Z', fill: '#f7931e', 'stroke-width': 3 })],
        ['path', { d: 'M45 72 Q50 88 55 72 Z', fill: '#ffd23f' }],
        ['path', o({ d: 'M34 50 L18 74 L36 70 Z', fill: '#e53935' })],
        ['path', o({ d: 'M66 50 L82 74 L64 70 Z', fill: '#e53935' })],
        ['path', o({ d: 'M50 6 C68 20 72 44 66 72 L34 72 C28 44 32 20 50 6 Z', fill: '#eceff1' })],
        ['path', o({ d: 'M41 16 Q50 8 59 16 Z', fill: '#e53935', 'stroke-width': 3 })],
        ['circle', o({ cx: 50, cy: 38, r: 9, fill: '#64b5f6', 'stroke-width': 3.5 })],
        ['path', { d: 'M46 35 Q48 32 51 32', fill: 'none', stroke: '#fff', 'stroke-width': 2.5, 'stroke-linecap': 'round' }]
      ]
    }
  };

  // ---------- Shapes (100x100, filled with opts.color) ----------
  var SHAPES = {
    circle: function (c) { return [['circle', o({ cx: 50, cy: 50, r: 40, fill: c })]]; },
    triangle: function (c) { return [['path', o({ d: 'M50 10 L92 86 L8 86 Z', fill: c })]]; },
    square: function (c) { return [['rect', o({ x: 12, y: 12, width: 76, height: 76, rx: 10, fill: c })]]; },
    diamond: function (c) { return [['path', o({ d: 'M50 6 L92 50 L50 94 L8 50 Z', fill: c })]]; },
    star: function (c) { return [['path', o({ d: starPath(50, 53, 44, 19, 5), fill: c })]]; },
    hexagon: function (c) { return [['path', o({ d: 'M28 12 H72 L94 50 L72 88 H28 L6 50 Z', fill: c })]]; }
  };
  var SHAPE_DEFAULT_COLOR = { circle: '#e53935', triangle: '#fbc02d', square: '#43a047', diamond: '#1e88e5', star: '#ffd23f', hexagon: '#8e24aa' };

  // ---------- UI icons (24x24, currentColor) ----------
  var UI = Object.assign({}, NS.player && NS.player.ICONS, {
    home: 'M12 3 2.5 11.5l1.7 1.8L5 12.6V21h5.5v-6h3v6H19v-8.4l.8.7 1.7-1.8z',
    speaker: 'M4 9v6h4l5 4.5V4.5L8 9zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z',
    star: 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z',
    hands: 'M7 21c-2.2 0-4-1.8-4-4v-6.5a1.25 1.25 0 0 1 2.5 0V14h.5V5.5a1.25 1.25 0 0 1 2.5 0V12h.5V4.25a1.25 1.25 0 0 1 2.5 0V12h.5V5.75a1.25 1.25 0 0 1 2.5 0V15l1.6-2.2a1.3 1.3 0 0 1 2.1 1.5L16 19.4A4 4 0 0 1 12.8 21z',
    check: 'M9.5 16.2 5.3 12l-1.8 1.8 6 6 11-11-1.8-1.8z',
    plus: 'M10.5 4h3v6.5H20v3h-6.5V20h-3v-6.5H4v-3h6.5z',
    minus: 'M4 10.5h16v3H4z',
    dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h14V5zm3 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm8 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-4-4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
    swap: 'M7 7h11l-3-3 1.4-1.4L21.8 8l-5.4 5.4L15 12l3-3H7zm10 10H6l3 3-1.4 1.4L2.2 16l5.4-5.4L9 12l-3 3h11z'
  });

  function build(U, spec) {
    var tag = spec[0], attrs = spec[1], kids = spec[2];
    return U.svg(tag, attrs, (kids || []).map(function (k) { return build(U, k); }));
  }

  function svgRoot(U, name, viewBox, opts, cls) {
    var size = opts.size;
    var attrs = {
      viewBox: viewBox,
      class: [cls, cls + '-' + name, opts.class].filter(Boolean).join(' '),
      focusable: 'false'
    };
    if (size) { attrs.width = size; attrs.height = size; }
    if (opts.title) { attrs.role = 'img'; attrs['aria-label'] = opts.title; }
    else attrs['aria-hidden'] = 'true';
    return U.svg('svg', attrs);
  }

  // render(name, {size, title, class, color, kind}) -> SVGElement. Unknown names throw.
  // A name can exist in several groups ('star'): art wins, then shape, then UI.
  // Force one with kind: 'shape' | 'ui'.
  function render(name, opts) {
    var U = NS.util;
    opts = opts || {};
    var root, nodes;
    if (opts.kind === 'shape' && SHAPES[name]) {
      root = svgRoot(U, name, '0 0 100 100', opts, 'icon-shape');
      nodes = SHAPES[name](opts.color || SHAPE_DEFAULT_COLOR[name]);
    } else if (opts.kind !== 'ui' && ART[name]) {
      root = svgRoot(U, name, '0 0 100 100', opts, 'icon-art');
      nodes = ART[name].nodes;
    } else if (opts.kind !== 'ui' && SHAPES[name]) {
      root = svgRoot(U, name, '0 0 100 100', opts, 'icon-shape');
      nodes = SHAPES[name](opts.color || SHAPE_DEFAULT_COLOR[name]);
    } else if (UI[name]) {
      root = svgRoot(U, name, '0 0 24 24', opts, 'icon');
      nodes = [['path', { d: UI[name], fill: 'currentColor' }]];
    } else {
      throw new Error('Unknown icon: ' + name);
    }
    nodes.forEach(function (n) { root.appendChild(build(U, n)); });
    return root;
  }

  function shape(name, color, opts) {
    return render(name, Object.assign({}, opts, { kind: 'shape', color: color || SHAPE_DEFAULT_COLOR[name] }));
  }

  function names(kind) {
    if (kind === 'art') return Object.keys(ART);
    if (kind === 'shape') return Object.keys(SHAPES);
    if (kind === 'ui') return Object.keys(UI);
    return Object.keys(ART).concat(Object.keys(SHAPES).filter(function (n) { return !ART[n]; }),
      Object.keys(UI).filter(function (n) { return !ART[n] && !SHAPES[n]; }));
  }

  function has(name) { return !!(ART[name] || SHAPES[name] || UI[name]); }
  function label(name) { return ART[name] ? ART[name].label : name.charAt(0).toUpperCase() + name.slice(1); }

  NS.icons = {
    INK: INK,
    render: render,
    shape: shape,
    names: names,
    has: has,
    label: label,
    ART: ART,
    SHAPES: SHAPES,
    UI: UI
  };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
