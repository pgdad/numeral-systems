// Multi-system readout: one number shown in several systems at once,
// e.g. "Decimal 11 · Binary 1011 · Hex B". Entries that change get a little glow.
//
//   var r = NS.readout.create({systems: ['decimal', 'binary', 'hex'], value: 11});
//   r.set(12, ctx);
(function (NS) {
  'use strict';

  var SHORT = { decimal: 'Decimal', binary: 'Binary', octal: 'Octal', hex: 'Hex', animals: 'Animals', colors: 'Colors' };

  function create(opts) {
    var U = NS.util, A = NS.anim;
    opts = opts || {};
    var systems = (opts.systems || ['decimal', 'binary', 'hex']).map(NS.digitsets.resolve);
    var value = opts.value || 0;

    var items = systems.map(function (s) {
      var val = U.el('span', { class: 'readout-value' });
      var item = U.el('span', { class: ['readout-item', 'theme-' + s.theme] },
        U.el('span', { class: 'readout-name', text: (opts.names && opts.names[s.id]) || SHORT[s.id] || s.name }), val);
      return { set: s, el: item, val: val, text: null };
    });
    var el = U.el('div', { class: ['readout', opts.class], role: 'status' }, items.map(function (it) { return it.el; }));

    function textOf(s, n) { return s.kind === 'text' ? NS.numeral.format(n, s, { groupSize: s.base === 2 ? 4 : 0 }) : null; }

    function draw(it) {
      U.clear(it.val);
      var t = textOf(it.set, value);
      if (t !== null) it.val.textContent = t;
      else it.val.appendChild(NS.symbols.strip(value, it.set));
      var key = t !== null ? t : NS.digitsets.speak(value, it.set);
      var changed = it.text !== null && it.text !== key;
      it.text = key;
      return changed;
    }

    function describe() {
      el.setAttribute('aria-label', items.map(function (it) {
        return (SHORT[it.set.id] || it.set.name) + ' ' + NS.digitsets.speak(value, it.set);
      }).join(', '));
    }

    var api = {
      el: el,
      get value() { return value; },
      set: function (n, ctx) {
        value = n;
        var changed = items.filter(draw);
        describe();
        return Promise.all(changed.map(function (it) { return A.highlight(it.el, ctx); }));
      },
      destroy: function () { if (el.parentNode) el.parentNode.removeChild(el); }
    };
    items.forEach(draw);
    describe();
    return api;
  }

  NS.readout = { create: create };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
