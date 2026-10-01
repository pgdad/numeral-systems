// Component gallery (#/gallery, hidden from the home menu): every component with buttons that
// trigger each animation, plus every icon. Used by lesson phases to try pieces out and for QA.
//   NS.gallery.mount(stage) -> {destroy()}   (DECISIONS D11)
(function (NS) {
  'use strict';

  var EXAMPLES = [
    { set: 'decimal', a: 47, b: 38 },
    { set: 'decimal', a: 999, b: 1 },
    { set: 'binary', a: 11, b: 6 },
    { set: 'octal', a: 15, b: 7 },
    { set: 'hex', a: 0x2A, b: 0x1F },
    { set: 'animals', a: 8, b: 7 },
    { set: 'colors', a: 5, b: 4 }
  ];

  function mount(stage) {
    var U = NS.util, A = NS.anim;
    var ac = new AbortController();      // whole view
    var action = new AbortController();  // the running demo; a new button press cancels it
    var opts = { instant: false, reduced: U.prefersReducedMotion(), speed: 1 };

    function ctx() {
      var c = { instant: opts.instant, reducedMotion: opts.reduced, speed: opts.speed, signal: action.signal };
      c.abortSignal = c.signal;
      c.sound = function (name) { return c.instant ? 0 : NS.sound.play(name); };
      c.wait = function (ms) { return A.wait(ms, c); };
      return c;
    }
    function go(fn) {
      return function () {
        action.abort();
        action = new AbortController();
        if (ac.signal.aborted) return;
        Promise.resolve().then(fn).catch(function (e) { if (!U.isAbortError(e)) console.error(e); });
      };
    }
    function btn(label, fn, cls) {
      return U.el('button', { type: 'button', class: ['btn', 'btn-sm', cls], onClick: go(fn) }, label);
    }
    function section(id, title, note) {
      var body = U.el('div', { class: 'gallery-body' });
      var sec = U.el('section', { class: 'gallery-section', id: 'g-' + id, dataset: { section: id } },
        U.el('h2', { text: title }), note ? U.el('p', { class: 'muted', text: note }) : null, body);
      return { el: sec, body: body };
    }
    function bar() { return U.el('div', { class: 'gallery-buttons' }, Array.prototype.slice.call(arguments)); }
    function toggle(label, get, set) {
      var input = U.el('input', { type: 'checkbox', onChange: function () { set(input.checked); } });
      input.checked = get();
      return U.el('label', { class: 'gallery-toggle' }, input, ' ' + label);
    }

    // ---------- Toolbar ----------
    var speedSel = U.el('select', { 'aria-label': 'Speed', onChange: function () { opts.speed = parseFloat(speedSel.value); } },
      [0.5, 1, 2].map(function (s) { return U.el('option', { value: String(s), text: s + '×', selected: s === 1 }); }));
    var toolbar = U.el('div', { class: 'gallery-toolbar' },
      toggle('Instant mode', function () { return opts.instant; }, function (v) { opts.instant = v; }),
      toggle('Reduced motion', function () { return opts.reduced; }, function (v) { opts.reduced = v; }),
      U.el('label', { class: 'gallery-toggle' }, 'Speed ', speedSel));

    var nav = U.el('nav', { class: 'gallery-nav', 'aria-label': 'Gallery sections' });
    var root = U.el('section', { class: 'gallery' },
      U.el('h1', { class: 'view-heading', tabindex: '-1', text: 'Component gallery' }),
      U.el('p', { class: 'lead', text: 'Every building block the lessons use. Press the buttons to try the animations.' }),
      toolbar, nav);

    var sections = [];
    function add(sec, title) {
      sections.push(sec);
      root.appendChild(sec.el);
      nav.appendChild(U.el('a', { href: '#g-' + sec.el.dataset.section, text: title,
        onClick: function (e) { e.preventDefault(); sec.el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }));
    }

    // ---------- Hands ----------
    (function () {
      var sec = section('hands', 'Hands', 'Backs of the hands, left hand on the left (D5). Right pinky = 1 … left pinky = 512.');
      var h = NS.hands.create({ hands: 'both', bits: 0 });
      var shown = U.el('output', { class: 'gallery-output', text: '0' });
      var input = U.el('input', { type: 'number', min: 0, max: 1023, value: 0, 'aria-label': 'Number for the hands', class: 'gallery-input' });
      var labelsOn = false, off = null;
      function show(n) { shown.textContent = n + ' = ' + NS.numeral.format(n, NS.digitsets.get('binary'), { minLength: 10 }); }
      function bits(n) { show(n); input.value = n; return h.setBits(n, ctx()); }
      sec.body.appendChild(h.el);
      sec.body.appendChild(U.el('div', { class: 'gallery-row' }, shown));
      sec.body.appendChild(bar(
        U.el('span', { class: 'gallery-label', text: 'Binary:' }),
        btn('0', function () { return bits(0); }), btn('1', function () { return bits(1); }),
        btn('5', function () { return bits(5); }), btn('11', function () { return bits(11); }),
        btn('512', function () { return bits(512); }), btn('1023', function () { return bits(1023); }),
        input, btn('Show', function () { return bits(U.clamp(parseInt(input.value, 10) || 0, 0, 1023)); }),
        btn('Count 0 → 31', function () {
          var c = ctx(), chain = h.setBits(0, c);
          U.range(1, 32).forEach(function (n) {
            chain = chain.then(function () { return A.wait(350, c); }).then(function () { show(n); return h.setBits(n, c); });
          });
          return chain;
        })));
      sec.body.appendChild(bar(
        U.el('span', { class: 'gallery-label', text: 'Base 10:' }),
        btn('Count 1 → 10', function () {
          var c = ctx(), chain = h.setFingers(0, c);
          U.range(1, 11).forEach(function (n) {
            chain = chain.then(function () { return A.wait(300, c); }).then(function () { shown.textContent = String(n); return h.setFingers(n, c); });
          });
          return chain;
        }),
        btn('Show 3', function () { shown.textContent = '3'; return h.setFingers(3, ctx()); }),
        btn('Left thumb', function () { var f = h.getFingers()[4]; return h.setFinger('left', 'thumb', !f, ctx()); })));
      sec.body.appendChild(bar(
        btn('Labels on/off', function () { labelsOn = !labelsOn; return h.labels(labelsOn, null, ctx()); }),
        btn('Wave', function () { return h.wave(ctx()); }),
        btn('Glow', function () { return h.glow(ctx()); }),
        btn('Clickable on/off', function () {
          if (off) { off(); off = null; return; }
          off = h.onToggle(function (info) { show(info.bits); input.value = info.bits; });
        })));
      sec.body.appendChild(U.el('div', { class: 'gallery-row' }, U.el('span', { class: 'gallery-label', text: 'Skin tone:' }), NS.hands.skinPicker()));
      var one = NS.hands.create({ hands: 'right', fingers: 0 });
      var oneOut = U.el('output', { class: 'gallery-output', text: '0' });
      sec.body.appendChild(U.el('h3', { text: 'One hand' }));
      sec.body.appendChild(U.el('div', { class: 'gallery-one-hand' }, one.el));
      sec.body.appendChild(bar(
        U.range(0, 6).map(function (n) { return btn(String(n), function () { oneOut.textContent = String(n); return one.setFingers(n, ctx()); }); }),
        btn('Wave', function () { return one.wave(ctx()); }), oneOut));
      add(sec, 'Hands');
    })();

    // ---------- Digit tiles ----------
    (function () {
      var sec = section('tiles', 'Digit tiles', 'Any digit from any system: text, animals and colors.');
      ['decimal', 'binary', 'hex', 'animals', 'colors'].forEach(function (id) {
        var set = NS.digitsets.get(id);
        var tiles = U.range(Math.min(set.base, 6)).map(function (v) { return NS.digitTile.create({ set: set, value: v, size: 'md' }); });
        var big = NS.digitTile.create({ set: set, value: set.base - 1, size: 'lg' });
        sec.body.appendChild(U.el('h3', { text: set.name }));
        sec.body.appendChild(U.el('div', { class: 'gallery-row tile-row' }, tiles.map(function (t) { return t.el; }), big.el));
        sec.body.appendChild(bar(
          btn('Pop', function () { return A.stagger(tiles.concat([big]), function (t) { return t.pop(ctx()); }, 80, ctx()); }),
          btn('Flip to next', function () { return big.flipTo((big.value + 1) % set.base, ctx()); }),
          btn('Wiggle', function () { return big.wiggle(ctx()); }),
          btn('Glow', function () { return big.glow(ctx()); }),
          btn('Lit on/off', function () { big.setLit(!big.el.classList.contains('is-lit')); })));
      });
      add(sec, 'Tiles');
    })();

    // ---------- Odometers ----------
    (function () {
      var sec = section('odometer', 'Odometers', 'Rolling counters in any system. Rolls over like a car odometer.');
      [['decimal', 3], ['binary', 4], ['hex', 2], ['animals', 3], ['colors', 3]].forEach(function (cfg) {
        var odo = NS.odometer.create({ set: cfg[0], places: cfg[1], labels: 'names' });
        var mode = 'names';
        sec.body.appendChild(U.el('h3', { text: odo.digitSet.name }));
        sec.body.appendChild(odo.el);
        sec.body.appendChild(bar(
          btn('−1', function () { return odo.step(-1, ctx()); }),
          btn('+1', function () { return odo.step(1, ctx()); }),
          btn('Run to max', function () { return odo.runTo(odo.max, ctx(), { msPerStep: 450, accelerate: true }); }),
          btn('Reset', function () { return odo.set(0, ctx()); }),
          btn('Glow ones', function () { return odo.highlightPlace(0, ctx()); }),
          btn('Labels', function () { mode = mode === 'names' ? 'numbers' : mode === 'numbers' ? false : 'names'; odo.labels(mode); })));
      });
      add(sec, 'Odometers');
    })();

    // ---------- Place value ----------
    (function () {
      var sec = section('place-value', 'Place value', 'Column headers, digits, contributions (200 + 30 + 7) and bundles.');
      var pv = NS.placeValue.create({ set: 'decimal', value: 237, places: 3, units: true });
      sec.body.appendChild(pv.el);
      sec.body.appendChild(bar(
        btn('Expand', function () { return pv.expand(ctx()); }),
        btn('Collapse', function () { return pv.collapse(ctx()); }),
        btn('+1', function () { return pv.set(Math.min(999, pv.value + 1), ctx()); }),
        btn('Glow tens', function () { return pv.highlightPlace(1, ctx()); }),
        btn('10 sticks → bundle', function () {
          var c = ctx();
          return pv.set(9, c).then(function () { return pv.setUnits(0, 10, c); })
            .then(function () { return A.wait(400, c); })
            .then(function () { return pv.regroup(0, c); });
        }),
        btn('Reset 237', function () { return pv.set(237, ctx()); })));
      [['binary', 11, 4], ['animals', 38, 3], ['hex', 0x2A, 2]].forEach(function (cfg) {
        var b = NS.placeValue.create({ set: cfg[0], value: cfg[1], places: cfg[2], units: true });
        sec.body.appendChild(U.el('h3', { text: b.digitSet.name }));
        sec.body.appendChild(b.el);
        sec.body.appendChild(bar(
          btn('Expand', function () { return b.expand(ctx()); }),
          btn('Collapse', function () { return b.collapse(ctx()); }),
          btn('+1', function () { return b.set((b.value + 1) % Math.pow(b.digitSet.base, b.places), ctx()); }),
          btn('Group the ones', function () {
            var c = ctx();
            return b.set(b.digitSet.base - 1, c).then(function () { return b.setUnits(0, b.digitSet.base, c); })
              .then(function () { return A.wait(400, c); })
              .then(function () { return b.regroup(0, c); });
          })));
      });
      add(sec, 'Place value');
    })();

    // ---------- Column addition ----------
    (function () {
      var sec = section('column-add', 'Column addition', 'Step through an addition. Carries hop to the next column.');
      var holder = U.el('div', { class: 'gallery-ca' });
      var current = null, exIndex = 0;
      var sel = U.el('select', { 'aria-label': 'Example', onChange: function () { exIndex = parseInt(sel.value, 10); build(); } },
        EXAMPLES.map(function (ex, i) {
          var s = NS.digitsets.get(ex.set);
          var label = s.kind === 'text'
            ? NS.numeral.format(ex.a, s) + ' + ' + NS.numeral.format(ex.b, s) + ' (' + s.shortName + ')'
            : NS.digitsets.speak(ex.a, s) + ' + ' + NS.digitsets.speak(ex.b, s);
          return U.el('option', { value: String(i), text: label });
        }));
      var said = U.el('p', { class: 'gallery-said', 'aria-live': 'polite' });
      function build() {
        U.clear(holder);
        said.textContent = '';
        var ex = EXAMPLES[exIndex];
        current = NS.columnAdd.create({ set: ex.set, a: ex.a, b: ex.b });
        holder.appendChild(current.el);
      }
      function explain(step) { said.textContent = NS.addition.explainStep(step, current.digitSet); }
      build();
      sec.body.appendChild(bar(sel,
        btn('Next column', function () {
          var step = current.steps[current.played];
          if (!step) return null;
          explain(step);
          return current.next(ctx());
        }),
        btn('Play all', function () {
          var c = ctx(), chain = Promise.resolve();
          current.steps.slice(current.played).forEach(function (step, k) {
            chain = chain.then(function () { return k ? A.wait(500, c) : null; })
              .then(function () { explain(step); return current.playStep(step, c); });
          });
          return chain;
        }),
        btn('Ask me', function () {
          var step = current.steps[current.played];
          if (!step) return null;
          said.textContent = 'Which digit goes in the answer?';
          return current.ask(step, ctx(), { onWrong: function () { said.textContent = 'Not quite, try again!'; } })
            .then(function () { explain(step); });
        }),
        btn('Reset', function () { current.reset(); said.textContent = ''; })));
      sec.body.appendChild(holder);
      sec.body.appendChild(said);
      add(sec, 'Addition');
    })();

    // ---------- Readout ----------
    (function () {
      var sec = section('readout', 'Readout', 'One number in several systems.');
      var r = NS.readout.create({ systems: ['decimal', 'binary', 'octal', 'hex', 'animals', 'colors'], value: 11 });
      sec.body.appendChild(r.el);
      sec.body.appendChild(bar(
        btn('−1', function () { return r.set(Math.max(0, r.value - 1), ctx()); }),
        btn('+1', function () { return r.set(r.value + 1, ctx()); }),
        btn('255', function () { return r.set(255, ctx()); })));
      add(sec, 'Readout');
    })();

    // ---------- Icons ----------
    (function () {
      var sec = section('icons', 'Icons', 'Original inline SVG (no emoji, no external files).');
      function grid(names, render) {
        return U.el('div', { class: 'icon-grid' }, names.map(function (n) {
          return U.el('figure', { class: 'icon-cell' }, render(n), U.el('figcaption', { text: n }));
        }));
      }
      sec.body.appendChild(U.el('h3', { text: 'Animals and things' }));
      sec.body.appendChild(grid(NS.icons.names('art'), function (n) { return NS.icons.render(n, { title: NS.icons.label(n) }); }));
      sec.body.appendChild(U.el('h3', { text: 'Shapes' }));
      sec.body.appendChild(grid(NS.icons.names('shape'), function (n) { return NS.icons.shape(n, null, { title: n }); }));
      sec.body.appendChild(U.el('h3', { text: 'Buttons' }));
      sec.body.appendChild(grid(NS.icons.names('ui'), function (n) { return NS.icons.render(n, { kind: 'ui', title: n }); }));
      add(sec, 'Icons');
    })();

    stage.appendChild(root);

    return {
      destroy: function () {
        ac.abort();
        action.abort();
        if (NS.narrator && NS.narrator.stop) NS.narrator.stop();
      }
    };
  }

  NS.gallery = { mount: mount };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
