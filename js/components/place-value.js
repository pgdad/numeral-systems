// Place-value board: one column per place with a header (place name), the digit, an optional
// "contribution" row (200 + 30 + 7 = 237), "x base" arrows between columns, and an optional
// bundle area that shows the quantity as things (sticks, bundles and crates for base 10;
// dots grouped by the base for other bases).
//
//   var pv = NS.placeValue.create({set: 'decimal', value: 237, places: 3, arrows: true, units: true});
//   pv.set(238, ctx); pv.expand(ctx); pv.collapse(ctx); pv.highlightPlace(1, ctx);
//   pv.setUnits(0, 10, ctx); pv.regroup(0, ctx)   // ten loose sticks become one bundle in the tens
//
// Places are powers (0 = ones), as everywhere else (DECISIONS D12).
(function (NS) {
  'use strict';

  // Contribution text for one place, written in decimal ("200").
  function contributionText(digit, power, base) {
    return String(digit * Math.pow(base, power));
  }

  function create(opts) {
    var U = NS.util, A = NS.anim;
    opts = opts || {};
    var set = NS.digitsets.resolve(opts.set || 'decimal');
    var base = set.base;
    var value = opts.value || 0;
    var places = Math.max(opts.places || 0, NS.numeral.toDigits(value, base).length);
    var labelMode = opts.labels || 'names';
    var expanded = false;

    var grid = U.el('div', { class: 'pv-grid' });
    var sumRow = U.el('div', { class: 'pv-sum', hidden: true });
    var el = U.el('div', {
      class: ['place-value', 'theme-' + set.theme, 'pv-kind-' + set.kind, opts.class],
      role: 'group'
    }, grid, sumRow);
    el.style.setProperty('--pv-places', places);

    var cols = []; // by power
    var counts = []; // units shown per power (may exceed base before regrouping)

    for (var i = 0; i < places; i++) {
      var power = places - 1 - i;
      var header = U.el('div', { class: 'pv-head' },
        U.el('span', { class: 'pv-name' }),
        U.el('span', { class: 'pv-placevalue' }));
      var tile = NS.digitTile.create({ set: set, value: 0, size: opts.tileSize || 'md', caption: false });
      var contrib = U.el('div', { class: 'pv-contrib' });
      var units = U.el('div', { class: 'pv-units', hidden: !opts.units });
      var col = U.el('div', { class: 'pv-col', dataset: { power: String(power) } }, header, U.el('div', { class: 'pv-digit' }, tile.el), contrib, units);
      grid.appendChild(col);
      if (power > 0 && opts.arrows !== false) {
        grid.appendChild(U.el('div', { class: 'pv-arrow', 'aria-hidden': 'true' },
          U.el('span', { class: 'pv-arrow-line' }),
          U.el('span', { class: 'pv-arrow-text', text: '×' + base })));
      }
      cols[power] = { el: col, header: header, tile: tile, contrib: contrib, units: units };
      counts[power] = 0;
    }

    function digitsOf(n) { return NS.numeral.padDigits(NS.numeral.toDigits(n, base), places); }

    function drawHeaders() {
      cols.forEach(function (c, power) {
        c.header.firstChild.textContent = labelMode === 'numbers'
          ? NS.digitsets.placeName(power, base, { style: 'number' }) : NS.digitsets.placeName(power, base);
        c.header.lastChild.textContent = labelMode === 'numbers' ? '' : String(Math.pow(base, power));
      });
    }

    function drawContrib() {
      var digits = digitsOf(value);
      digits.forEach(function (d, i) {
        var power = places - 1 - i;
        cols[power].contrib.textContent = contributionText(d, power, base);
      });
      U.clear(sumRow);
      var parts = [];
      digits.forEach(function (d, i) {
        if (i) parts.push(U.el('span', { class: 'pv-op', text: '+' }));
        parts.push(U.el('span', { class: 'pv-term', text: contributionText(d, places - 1 - i, base) }));
      });
      parts.push(U.el('span', { class: 'pv-op', text: '=' }));
      parts.push(U.el('span', { class: 'pv-total', text: String(value) }));
      parts.forEach(function (p) { sumRow.appendChild(p); });
    }

    // ---------- Units (sticks / bundles / crates, or grouped dots) ----------
    function unitSvg(power) {
      var cls = 'pv-unit pv-unit-p' + Math.min(power, 2);
      if (base === 10) return decimalUnit(power, cls);
      return dotUnit(power, cls);
    }

    function decimalUnit(power, cls) {
      if (power === 0) {
        return U.svg('svg', { viewBox: '0 0 12 60', class: cls + ' pv-stick', 'aria-hidden': 'true' },
          U.svg('rect', { x: 2, y: 2, width: 8, height: 56, rx: 4, class: 'pv-wood' }));
      }
      if (power === 1) {
        var sticks = U.range(10).map(function (k) {
          return U.svg('rect', { x: 3 + k * 5, y: 2, width: 6, height: 56, rx: 3, class: 'pv-wood' });
        });
        return U.svg('svg', { viewBox: '0 0 60 60', class: cls + ' pv-bundle', 'aria-hidden': 'true' },
          sticks, U.svg('rect', { x: 1, y: 26, width: 58, height: 9, rx: 3, class: 'pv-band' }));
      }
      // A crate holds ten bundles (one hundred). Bigger places reuse the crate with a label.
      return U.svg('svg', { viewBox: '0 0 60 60', class: cls + ' pv-crate', 'aria-hidden': 'true' },
        U.svg('rect', { x: 3, y: 8, width: 54, height: 48, rx: 6, class: 'pv-crate-box' }),
        U.range(10).map(function (k) { return U.svg('rect', { x: 7 + k * 4.8, y: 3, width: 4, height: 18, rx: 2, class: 'pv-wood' }); }),
        U.svg('path', { d: 'M3 30 H57 M3 43 H57', class: 'pv-crate-line' }),
        U.svg('text', { x: 30, y: 39, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'pv-crate-text' },
          String(Math.pow(10, power))));
    }

    function dotUnit(power, cls) {
      if (power === 0) {
        return U.svg('svg', { viewBox: '0 0 20 20', class: cls + ' pv-dot', 'aria-hidden': 'true' },
          U.svg('circle', { cx: 10, cy: 10, r: 7, class: 'pv-dot-fill' }));
      }
      // A ring holding `base` dots (power 1); bigger places are a double ring labeled with their value.
      var n = base;
      var kids = power > 1 ? [] : U.range(n).map(function (k) {
        var a = (Math.PI * 2 * k) / n - Math.PI / 2;
        var r = n > 8 ? 19 : 16;
        var cx = 30 + r * Math.cos(a), cy = 30 + r * Math.sin(a);
        var small = n > 8 ? 3.2 : 4.5;
        return U.svg('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: small, class: 'pv-dot-fill' });
      });
      return U.svg('svg', { viewBox: '0 0 60 60', class: cls + ' pv-group', 'aria-hidden': 'true' },
        U.svg('circle', { cx: 30, cy: 30, r: 27, class: 'pv-ring' }),
        power > 1 ? U.svg('circle', { cx: 30, cy: 30, r: 20, class: 'pv-ring-small' }) : null, kids,
        power > 1 ? U.svg('text', { x: 30, y: 31, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'pv-group-text' },
          String(Math.pow(base, power))) : null);
    }

    function drawUnits(power) {
      var c = cols[power];
      U.clear(c.units);
      for (var k = 0; k < counts[power]; k++) c.units.appendChild(unitSvg(power));
      c.units.classList.toggle('is-full', counts[power] >= base);
    }

    function syncCountsFromValue() {
      digitsOf(value).forEach(function (d, i) { counts[places - 1 - i] = d; });
      cols.forEach(function (c, p) { drawUnits(p); });
    }

    function describe() {
      el.setAttribute('aria-label', 'Place value board showing ' + NS.digitsets.speak(value, set));
      el.dataset.value = String(value);
    }

    function setValue(n, ctx) {
      var max = Math.pow(base, places) - 1;
      if (n < 0 || n > max) throw new RangeError('This board holds 0 to ' + max + ' (got ' + n + ')');
      value = n;
      describe();
      drawContrib();
      syncCountsFromValue();
      var digits = digitsOf(n);
      return Promise.all(digits.map(function (d, i) {
        return cols[places - 1 - i].tile.flipTo(d, ctx);
      }));
    }

    var api = {
      el: el,
      get value() { return value; },
      get digitSet() { return set; },
      places: places,
      set: setValue,
      tile: function (power) { return cols[power] && cols[power].tile; },
      column: function (power) { return cols[power] && cols[power].el; },
      // Show "200 + 30 + 7 = 237" (contributions pop in from the biggest place).
      expand: function (ctx) {
        expanded = true;
        el.classList.add('is-expanded');
        sumRow.hidden = false;
        var items = cols.slice().reverse().map(function (c) { return c.contrib; });
        items.forEach(function (x) { x.style.opacity = '0'; });
        Array.prototype.forEach.call(sumRow.children, function (x) { x.style.opacity = '0'; });
        return A.stagger(items, function (x) { return A.pop(x, ctx); }, 250, ctx).then(function () {
          return A.stagger(sumRow.children, function (x) { return A.pop(x, ctx); }, 120, ctx);
        });
      },
      collapse: function (ctx) {
        expanded = false;
        var items = cols.map(function (c) { return c.contrib; }).concat([sumRow]);
        return Promise.all(items.map(function (x) { return A.fadeOut(x, ctx); })).then(function () {
          el.classList.remove('is-expanded');
          sumRow.hidden = true;
          items.forEach(function (x) { x.style.opacity = ''; });
        });
      },
      isExpanded: function () { return expanded; },
      highlightPlace: function (power, ctx) {
        var c = cols[power];
        if (!c) return Promise.resolve();
        return A.highlight(c.el, ctx);
      },
      markPlace: function (power) {
        cols.forEach(function (c, p) { c.el.classList.toggle('is-marked', p === power); });
      },
      labels: function (mode) { labelMode = mode; drawHeaders(); },
      showUnits: function (on, ctx) {
        var list = cols.map(function (c) { return c.units; });
        list.forEach(function (u) { u.hidden = !on; });
        if (!on) return Promise.resolve();
        return A.stagger(list, function (u) { return A.fadeIn(u, ctx); }, 120, ctx);
      },
      // Show k loose units in one place (k may reach the base, ready to regroup). New ones pop in.
      setUnits: function (power, k, ctx) {
        var c = cols[power];
        var before = counts[power];
        counts[power] = k;
        drawUnits(power);
        var fresh = Array.prototype.slice.call(c.units.children, before);
        return A.stagger(fresh, function (u) { return A.pop(u, ctx); }, 90, ctx);
      },
      units: function (power) { return counts[power]; },
      // Bundle `base` units of a place into one unit of the next place:
      // the units squeeze together, then one bigger unit pops into the next column.
      regroup: function (power, ctx) {
        var c = cols[power], next = cols[power + 1];
        if (!next) return Promise.reject(new RangeError('No bigger place to carry into'));
        if (counts[power] < base) return Promise.reject(new RangeError('Need ' + base + ' units to make a group'));
        var group = Array.prototype.slice.call(c.units.children, 0, base);
        var target = next.units;
        function finish() {
          counts[power] -= base;
          counts[power + 1] += 1;
          drawUnits(power);
          drawUnits(power + 1);
          value = cols.reduce(function (acc, col, p) { return acc + Math.min(counts[p], base - 1) * Math.pow(base, p); }, 0);
          describe();
          drawContrib();
          cols.forEach(function (col, p) { col.tile.setValue(Math.min(counts[p], base - 1)); });
          var newest = next.units.lastChild;
          return A.pop(newest, ctx);
        }
        if (ctx && ctx.instant) return finish();
        if (ctx && ctx.signal && ctx.signal.aborted) return Promise.reject(U.abortError());
        // Squeeze toward the middle of the group, then fly toward the next column.
        var first = group[0].getBoundingClientRect();
        var last = group[group.length - 1].getBoundingClientRect();
        var midX = (first.left + last.right) / 2;
        var tRect = target.getBoundingClientRect();
        return Promise.all(group.map(function (u) {
          var r = u.getBoundingClientRect();
          var dx = midX - (r.left + r.width / 2);
          return A.run(u, [{ transform: 'translate(0px, 0px)' }, { transform: 'translate(' + dx + 'px, 0px) scale(.8)' }],
            { duration: 450, easing: 'ease-in-out' }, ctx);
        })).then(function () {
          var fly = (tRect.left + tRect.width / 2) - midX;
          return Promise.all(group.map(function (u) {
            return A.run(u, [{ transform: u.style.transform }, {
              transform: u.style.transform.replace(/translate\(([-\d.]+)px/, function (m, x) { return 'translate(' + (parseFloat(x) + fly) + 'px'; }) + ' scale(.6)',
              opacity: 0
            }], { duration: 500, easing: 'ease-in' }, ctx);
          }));
        }).then(finish, function (e) { finish().catch(function () {}); throw e; });
      },
      destroy: function () { if (el.parentNode) el.parentNode.removeChild(el); }
    };

    drawHeaders();
    drawContrib();
    syncCountsFromValue();
    digitsOf(value).forEach(function (d, i) { cols[places - 1 - i].tile.setValue(d); });
    describe();
    if (opts.expanded) api.expand({ instant: true });
    return api;
  }

  NS.placeValue = { create: create, contributionText: contributionText };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
