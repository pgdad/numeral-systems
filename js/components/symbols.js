// Draw any digit from any digit set (NS.digitsets) as an SVG element, so every component can
// show text digits ("7", "F"), icon digits (cat, dog...) and color digits (red circle...) the same way.
//
//   NS.symbols.render(set.digits[2], set, {size: 64})   -> <svg class="symbol symbol-icon">
//   NS.symbols.renderValue(2, 'animals')                -> same, by value
//   NS.symbols.strip(13, 'animals', {minLength: 3})     -> <span class="symbol-strip"> of symbols
(function (NS) {
  'use strict';

  function setOf(set) { return NS.digitsets.resolve(set); }

  function render(digit, set, opts) {
    var U = NS.util;
    var s = setOf(set);
    opts = opts || {};
    var attrs = {
      viewBox: '0 0 100 100',
      class: ['symbol', 'symbol-' + s.kind, opts.class].filter(Boolean).join(' '),
      role: 'img',
      'aria-label': digit.speak || digit.label,
      focusable: 'false',
      dataset: { value: String(digit.value) }
    };
    if (opts.size) { attrs.width = opts.size; attrs.height = opts.size; }
    var root;
    if (s.kind === 'icon') {
      root = U.svg('svg', attrs);
      var art = NS.icons.render(digit.icon, {});
      while (art.firstChild) root.appendChild(art.firstChild);
    } else if (s.kind === 'color') {
      root = U.svg('svg', attrs);
      var shape = NS.icons.render(digit.shape, { kind: 'shape', color: digit.color });
      while (shape.firstChild) root.appendChild(shape.firstChild);
    } else {
      root = U.svg('svg', attrs,
        U.svg('text', {
          x: 50, y: 54, 'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': Array.from(digit.label).length > 1 ? 56 : 84, 'font-weight': 900,
          class: 'symbol-text-glyph', fill: 'currentColor'
        }, digit.label));
    }
    return root;
  }

  function renderValue(value, set, opts) {
    var s = setOf(set);
    var d = s.digits[value];
    if (!d) throw new RangeError('Value ' + value + ' is not a digit in ' + s.id);
    return render(d, s, opts);
  }

  // A row of symbols for a whole number (most significant first).
  function strip(n, set, opts) {
    var U = NS.util;
    var s = setOf(set);
    opts = opts || {};
    var values = NS.numeral.padDigits(NS.numeral.toDigits(n, s.base), opts.minLength);
    return U.el('span', {
      class: ['symbol-strip', 'symbol-strip-' + s.kind, opts.class].filter(Boolean).join(' '),
      role: 'img',
      'aria-label': NS.digitsets.speak(n, s)
    }, values.map(function (v) {
      var sym = renderValue(v, s, { size: opts.size });
      sym.removeAttribute('role');
      sym.removeAttribute('aria-label');
      sym.setAttribute('aria-hidden', 'true');
      return sym;
    }));
  }

  NS.symbols = { render: render, renderValue: renderValue, strip: strip };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
