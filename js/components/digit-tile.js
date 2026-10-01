// Digit tile: a big rounded tile showing one digit from any digit set.
//
//   var t = NS.digitTile.create({set: 'hex', value: 10, size: 'lg', caption: true});
//   stage.appendChild(t.el);
//   t.pop(ctx); t.flipTo(11, ctx); t.wiggle(ctx); t.glow(ctx); t.setLit(true);
//
// Every animation takes a ctx ({instant, speed, reducedMotion, signal}) like NS.anim and
// ends in the same state when ctx.instant is set (DECISIONS D13).
(function (NS) {
  'use strict';

  function create(opts) {
    var U = NS.util, A = NS.anim;
    opts = opts || {};
    var set = NS.digitsets.resolve(opts.set || 'decimal');
    var value = opts.value === undefined ? 0 : opts.value;
    var size = opts.size || 'md';

    var face = U.el('span', { class: 'tile-face' });
    var caption = U.el('span', { class: 'tile-caption' });
    var el = U.el('span', { class: ['digit-tile', 'tile-' + size, 'theme-' + set.theme, 'tile-kind-' + set.kind, opts.class] },
      face, caption);
    if (opts.hidden) el.style.opacity = '0';

    function showCaption() {
      return opts.caption === undefined ? set.kind !== 'text' : !!opts.caption;
    }

    function draw() {
      U.clear(face);
      if (value === null) {
        el.classList.add('is-blank');
        el.setAttribute('aria-label', 'empty');
        caption.textContent = '';
      } else {
        el.classList.remove('is-blank');
        var d = set.digits[value];
        face.appendChild(NS.symbols.render(d, set));
        caption.textContent = showCaption() ? d.label : '';
        el.setAttribute('aria-label', d.speak || d.label);
      }
      caption.hidden = !showCaption();
      el.dataset.value = value === null ? '' : String(value);
    }
    el.setAttribute('role', 'img');
    draw();

    var api = {
      el: el,
      get value() { return value; },
      get digitSet() { return set; },
      // Change the digit without animation (null = blank tile).
      setValue: function (v) { value = v; draw(); return api; },
      setDigitSet: function (s, v) {
        el.classList.remove('theme-' + set.theme, 'tile-kind-' + set.kind);
        set = NS.digitsets.resolve(s);
        el.classList.add('theme-' + set.theme, 'tile-kind-' + set.kind);
        if (v !== undefined) value = v;
        if (value !== null && value >= set.base) value = set.base - 1;
        draw();
        return api;
      },
      pop: function (ctx) { return A.pop(el, ctx); },
      fadeIn: function (ctx) { return A.fadeIn(el, ctx); },
      wiggle: function (ctx) { return A.wiggle(el, ctx); },
      bounce: function (ctx) { return A.bounce(el, ctx); },
      glow: function (ctx) { return A.highlight(el, ctx); },
      // Persistent "lit" look (theme-colored background).
      setLit: function (on) { el.classList.toggle('is-lit', !!on); return api; },
      // Flip over (like a card) and come back showing the new digit.
      flipTo: function (v, ctx) {
        ctx = ctx || {};
        if (ctx.instant || ctx.reducedMotion || v === value) {
          api.setValue(v);
          el.style.transform = '';
          return ctx.signal && ctx.signal.aborted ? Promise.reject(U.abortError()) : Promise.resolve();
        }
        function finish() { el.style.transform = ''; if (value !== v) api.setValue(v); }
        return A.run(el, [{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(90deg)' }], { duration: 180, easing: 'ease-in' }, ctx)
          .then(function () {
            api.setValue(v);
            return A.run(el, [{ transform: 'rotateX(-90deg)' }, { transform: 'rotateX(0deg)' }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' }, ctx);
          })
          .then(finish, function (err) { finish(); throw err; });
      }
    };
    return api;
  }

  NS.digitTile = { create: create };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
