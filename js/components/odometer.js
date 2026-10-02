// Odometer: a row of rolling digit windows in any digit set (like a car's mileage counter).
//
//   var odo = NS.odometer.create({set: 'binary', places: 4, value: 0, labels: 'names'});
//   odo.step(+1, ctx)                         roll to the next number
//   odo.runTo(15, ctx, {msPerStep: 500, accelerate: true, onStep: fn})
//   odo.set(9, ctx)                           roll every changed place at once
//   odo.highlightPlace(0, ctx)                glow the ones place (powers: 0 = ones)
//
// labels: false | 'names' ("Ones, Twos, Fours") | 'numbers' ("1s, 2s, 4s").
// digitNames: show each digit's name under its symbol (default: on for color sets, so colors
//   never rely on color alone). carryHop: when counting up rolls a place over, the carried
//   digit (a "1": a Dog for animals) jumps in an arc into the next place before it rolls.
// dimLeading: places in front of the number (leading zeros) are dimmed.
// Numbers wrap around like a real odometer: with 3 decimal places, 999 + 1 rolls over to 000.
(function (NS) {
  'use strict';

  var HOP_MS = 700;

  function create(opts) {
    var U = NS.util, A = NS.anim;
    opts = opts || {};
    var set = NS.digitsets.resolve(opts.set || 'decimal');
    var places = opts.places || 3;
    var modulo = Math.pow(set.base, places);
    var value = wrap(opts.value || 0);
    var labelMode = opts.labels === undefined ? 'names' : opts.labels;
    var digitNames = opts.digitNames === undefined ? set.kind === 'color' : !!opts.digitNames;

    function wrap(n) { return ((n % modulo) + modulo) % modulo; }
    function digitsOf(n) { return NS.numeral.padDigits(NS.numeral.toDigits(n, set.base), places); }

    var columns = []; // by power: {el, window, label, cell, value}
    var row = U.el('div', { class: 'odo-row' });
    for (var i = 0; i < places; i++) {
      var power = places - 1 - i;
      var label = U.el('span', { class: 'odo-label' });
      var win = U.el('span', { class: 'odo-window' });
      var col = U.el('span', { class: 'odo-place', dataset: { power: String(power) } }, label, win);
      row.appendChild(col);
      columns[power] = { el: col, window: win, label: label, cell: null, value: null };
    }
    var el = U.el('div', {
      class: ['odometer', 'theme-' + set.theme, 'odo-kind-' + set.kind, 'odo-size-' + (opts.size || 'md'),
        digitNames ? 'odo-named' : '', opts.class],
      role: 'img'
    }, row);

    function cellFor(v) {
      var sym = NS.symbols.renderValue(v, set);
      if (!digitNames) return U.el('span', { class: 'odo-cell' }, sym);
      return U.el('span', { class: 'odo-cell has-name' }, sym,
        U.el('span', { class: 'odo-cell-name', 'aria-hidden': 'true', text: set.digits[v].label }));
    }

    function dim() {
      if (!opts.dimLeading) return;
      var length = NS.numeral.toDigits(value, set.base).length;
      columns.forEach(function (c, power) { c.el.classList.toggle('is-lead', power >= length); });
    }

    // The carried digit jumps out of place `from` and lands on place `from + 1`.
    function hop(from, ctx) {
      var a = columns[from].window.getBoundingClientRect();
      var b = columns[from + 1].window.getBoundingClientRect();
      var box = el.getBoundingClientRect();
      var jumper = U.el('span', { class: 'odo-hop', 'aria-hidden': 'true' }, NS.symbols.renderValue(1, set));
      jumper.style.left = (a.left - box.left) + 'px';
      jumper.style.top = (a.top - box.top) + 'px';
      jumper.style.width = a.width + 'px';
      jumper.style.height = a.height + 'px';
      el.appendChild(jumper);
      var dx = b.left - a.left;
      var lift = Math.max(a.height * 0.9, 40);
      if (ctx.sound) ctx.sound('carry');
      function done() { if (jumper.parentNode) jumper.parentNode.removeChild(jumper); }
      return A.run(jumper, [
        { transform: 'translate(0px, 0px) scale(.6) rotate(0deg)', opacity: 0 },
        { transform: 'translate(0px, ' + (-lift * 0.3) + 'px) scale(.9) rotate(0deg)', opacity: 1, offset: 0.15 },
        { transform: 'translate(' + (dx / 2) + 'px, ' + (-lift) + 'px) scale(1.15) rotate(-20deg)', opacity: 1, offset: 0.55 },
        { transform: 'translate(' + dx + 'px, 0px) scale(1) rotate(0deg)', opacity: 1 }
      ], { duration: HOP_MS, easing: 'ease-in-out' }, ctx, 'transient').then(done, function (e) { done(); throw e; });
    }

    function drawLabels() {
      columns.forEach(function (c, power) {
        c.label.hidden = !labelMode;
        c.label.textContent = labelMode === 'numbers'
          ? NS.digitsets.placeName(power, set.base, { style: 'number' })
          : labelMode ? NS.digitsets.placeName(power, set.base) : '';
      });
    }

    function describe() {
      el.setAttribute('aria-label', 'Odometer showing ' + NS.digitsets.speak(value, set));
      el.dataset.value = String(value);
    }

    function place(power, v) {
      var c = columns[power];
      U.clear(c.window);
      c.cell = cellFor(v);
      c.window.appendChild(c.cell);
      c.value = v;
    }

    // Roll one place to digit v. dir: +1 (new digit comes up from below) or -1 (comes down from above).
    function roll(power, v, dir, ctx, duration) {
      var c = columns[power];
      if (c.value === v) return Promise.resolve();
      ctx = ctx || {};
      if (ctx.instant || ctx.reducedMotion || duration < 50) {
        place(power, v);
        return ctx.signal && ctx.signal.aborted ? Promise.reject(U.abortError()) : Promise.resolve();
      }
      var old = c.cell;
      var next = cellFor(v);
      c.window.appendChild(next);
      c.cell = next;
      c.value = v;
      var from = dir > 0 ? '100%' : '-100%';
      var to = dir > 0 ? '-100%' : '100%';
      var o = { duration: duration, easing: 'cubic-bezier(.3,1.35,.6,1)' };
      var outgoing = old
        ? A.run(old, [{ transform: 'translateY(0)' }, { transform: 'translateY(' + to + ')' }], o, ctx)
            .then(function () { if (old.parentNode) old.parentNode.removeChild(old); },
                  function (e) { if (old.parentNode) old.parentNode.removeChild(old); throw e; })
        : Promise.resolve();
      var incoming = A.run(next, [{ transform: 'translateY(' + from + ')' }, { transform: 'translateY(0%)' }], o, ctx);
      return Promise.all([outgoing, incoming]);
    }

    // Move to n, rolling every place that changes (all together).
    function set_(n, ctx, o) {
      o = o || {};
      var target = wrap(n);
      var dir = o.dir || (n >= value ? 1 : -1);
      var digits = digitsOf(target);
      var before = digitsOf(value);
      // Counting up by one: each place that rolls over to zero sends a carry into the next place.
      var hops = opts.carryHop && ctx && !ctx.instant && !ctx.reducedMotion && dir > 0 && target === value + 1;
      value = target;
      describe();
      dim();
      var duration = o.duration || 420;
      return Promise.all(digits.map(function (d, i) {
        var power = places - 1 - i;
        var carried = hops && power > 0 && d !== before[i] && digits[i + 1] === 0 && before[i + 1] === set.base - 1;
        if (!carried) return roll(power, d, dir, ctx, duration);
        // Wait for any carry into the place below to land, then this carry jumps.
        var waitBelow = A.wait(HOP_MS * (power - 1), ctx);
        return waitBelow.then(function () { return hop(power - 1, ctx); })
          .then(function () { return roll(power, d, dir, ctx, duration); },
            function (e) { place(power, d); throw e; });
      }));
    }

    var api = {
      el: el,
      get value() { return value; },
      get digitSet() { return set; },
      places: places,
      max: modulo - 1,
      set: function (n, ctx) { return set_(n, ctx); },
      step: function (dir, ctx) { dir = dir < 0 ? -1 : 1; return set_(value + dir, ctx, { dir: dir }); },
      // Count to n one number at a time. o: {msPerStep (default 500), accelerate, minMs, onStep(entry)}.
      runTo: function (n, ctx, o) {
        ctx = ctx || {};
        o = o || {};
        var target = U.clamp(n, 0, modulo - 1);
        if (ctx.instant) { set_(target, ctx); if (o.onStep) o.onStep({ n: target }); return Promise.resolve(); }
        var hopMs = opts.carryHop && !ctx.reducedMotion ? HOP_MS : 0;
        var seq = NS.numeral.countSequence(value, target, set.base).slice(1);
        var ms = o.msPerStep || 500;
        var minMs = o.minMs || 40;
        var dir = target >= value ? 1 : -1;
        var chain = Promise.resolve();
        seq.forEach(function (entry) {
          chain = chain.then(function () {
            if (ctx.signal && ctx.signal.aborted) throw U.abortError();
            var stepMs = ms;
            if (o.accelerate) ms = Math.max(minMs, ms * 0.88);
            set_(entry.n, ctx, { dir: dir, duration: Math.min(420, stepMs * 0.75) }).catch(function () {});
            if (o.onStep) o.onStep(entry);
            // Leave time for a carry to land before the next number.
            var carried = hopMs && dir > 0 && entry.changedPlaces && entry.changedPlaces.length > 1;
            return A.wait(carried ? Math.max(stepMs, hopMs + 200) : stepMs, ctx);
          });
        });
        return chain;
      },
      labels: function (mode) { labelMode = mode; drawLabels(); },
      highlightPlace: function (power, ctx) {
        var c = columns[power];
        if (!c) return Promise.resolve();
        c.el.classList.add('is-highlight');
        return A.highlight(c.window, ctx).then(function () { c.el.classList.remove('is-highlight'); },
          function (e) { c.el.classList.remove('is-highlight'); throw e; });
      },
      // Persistent emphasis on one place (null clears).
      markPlace: function (power) {
        columns.forEach(function (c, p) { c.el.classList.toggle('is-marked', p === power); });
      },
      placeEl: function (power) { return columns[power] && columns[power].el; },
      destroy: function () { if (el.parentNode) el.parentNode.removeChild(el); }
    };

    digitsOf(value).forEach(function (d, i) { place(places - 1 - i, d); });
    dim();
    drawLabels();
    describe();
    return api;
  }

  NS.odometer = { create: create };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
