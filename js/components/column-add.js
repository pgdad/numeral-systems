// Column addition in any digit set: the two numbers, a carry row, a rule line and the answer.
// Each step of NS.addition.addSteps() is animated: the column lights up, a sum bubble shows
// what the digits add up to, the answer digit pops in, and a carry hops in an arc to the next
// column (for animals, the carried animal itself jumps).
//
//   var ca = NS.columnAdd.create({set: 'hex', a: 0x2A, b: 0x1F});
//   ca.next(ctx)                  play the next column       ca.playAll(ctx)    every column
//   ca.playStep(ca.steps[0], ctx) play a given step          ca.reset()
//   ca.ask(ca.steps[0], ctx)      interactive: child picks the answer digit; resolves when right
//   ca.showSum(step, ctx) / ca.writeDigit(step, ctx) / ca.carry(step, ctx)
//                                 the three parts of playStep, for narration-synced or interactive use
//
// Options: names (show each digit's name under its symbol; default on for color sets, DECISIONS D18),
// hop ('arc' | 'leap' | 'bounce' | 'spin' | 'flip' | 'wobble': how the carry travels; default 'arc').
// A written digit plays its own sound when it has one (animals), else 'pop'; a landed carry likewise.
//
// Layout logic is pure (NS.columnAdd.layout) and unit-tested.
(function (NS) {
  'use strict';

  // layout(47, 38, 10) -> {width: 2, a: [4, 7], b: [3, 8], sum: [8, 5], steps}
  // Digit rows are most significant first, padded with null so columns line up. width includes
  // the extra place a final carry needs.
  function layout(a, b, base) {
    var steps = NS.addition.addSteps(a, b, base);
    var width = steps.length;
    function row(n) {
      var d = NS.numeral.toDigits(n, base);
      var out = [];
      for (var i = 0; i < width - d.length; i++) out.push(null);
      return out.concat(d);
    }
    return { width: width, a: row(a), b: row(b), sum: row(a + b), steps: steps };
  }

  function create(opts) {
    var U = NS.util, A = NS.anim;
    opts = opts || {};
    var set = NS.digitsets.resolve(opts.set || 'decimal');
    var a = opts.a || 0, b = opts.b || 0;
    var lay = layout(a, b, set.base);
    var width = lay.width;
    var played = 0;
    var names = opts.names === undefined ? set.kind === 'color' : !!opts.names;
    var hopStyle = opts.hop || 'arc';

    var grid = U.el('div', { class: 'ca-grid' });
    grid.style.setProperty('--ca-cols', width);
    var bubble = U.el('div', { class: 'ca-bubble', hidden: true, 'aria-live': 'polite' });
    var choices = U.el('div', { class: 'ca-choices', hidden: true, role: 'group', 'aria-label': 'Pick the answer digit' });
    var el = U.el('div', {
      class: ['column-add', 'theme-' + set.theme, 'ca-kind-' + set.kind, names ? 'ca-named-digits' : '', opts.class],
      role: 'group',
      'aria-label': 'Adding ' + NS.digitsets.speak(a, set) + ' and ' + NS.digitsets.speak(b, set)
    }, U.el('div', { class: 'ca-board' }, grid, bubble), choices);

    // A digit's symbol; with names on, wrapped together with its name (the wrapper carries the label).
    function sym(v, cls) {
      var s = NS.symbols.renderValue(v, set);
      if (!names) {
        if (cls) s.classList.add(cls);
        return s;
      }
      s.removeAttribute('role');
      s.removeAttribute('aria-label');
      s.setAttribute('aria-hidden', 'true');
      return U.el('span', { class: ['ca-named', cls], role: 'img', 'aria-label': set.digits[v].speak, dataset: { value: String(v) } },
        s, U.el('span', { class: 'ca-name', 'aria-hidden': 'true', text: set.digits[v].label }));
    }
    function cell(row, power, cls, content) {
      var c = U.el('div', { class: ['ca-cell', cls], dataset: { power: String(power) } }, content);
      c.style.gridRow = String(row);
      c.style.gridColumn = String(2 + (width - 1 - power));
      grid.appendChild(c);
      return c;
    }

    // Column backgrounds (behind the cells), used for highlighting.
    var colBg = [], carryCells = [], resultCells = [];
    for (var p = 0; p < width; p++) {
      var bg = U.el('div', { class: 'ca-colbg', dataset: { power: String(p) } });
      bg.style.gridRow = '1 / 6';
      bg.style.gridColumn = String(2 + (width - 1 - p));
      grid.appendChild(bg);
      colBg[p] = bg;
    }
    var sign = U.el('div', { class: 'ca-sign', text: '+', 'aria-hidden': 'true' });
    sign.style.gridRow = '3';
    sign.style.gridColumn = '1';
    grid.appendChild(sign);
    for (var q = 0; q < width; q++) {
      var i = width - 1 - q; // index into most-significant-first rows
      carryCells[q] = cell(1, q, 'ca-carry');
      cell(2, q, 'ca-a', lay.a[i] === null ? null : sym(lay.a[i]));
      cell(3, q, 'ca-b', lay.b[i] === null ? null : sym(lay.b[i]));
      resultCells[q] = cell(5, q, 'ca-result');
    }
    var rule = U.el('div', { class: 'ca-rule', 'aria-hidden': 'true' });
    rule.style.gridRow = '4';
    rule.style.gridColumn = '1 / ' + (width + 2);
    grid.appendChild(rule);

    function activate(power) {
      colBg.forEach(function (bgEl, pw) { bgEl.classList.toggle('is-active', pw === power); });
    }

    function showBubble(step) {
      U.clear(bubble);
      bubble.hidden = false;
      var terms = step.finalCarry ? [step.carryIn] : (step.carryIn ? [step.carryIn, step.da, step.db] : [step.da, step.db]);
      var expr = U.el('div', { class: 'ca-bubble-expr' });
      terms.forEach(function (v, k) {
        if (k) expr.appendChild(U.el('span', { class: 'ca-op', text: '+' }));
        expr.appendChild(sym(v, 'ca-bubble-sym'));
      });
      expr.appendChild(U.el('span', { class: 'ca-op', text: '=' }));
      expr.appendChild(U.el('span', { class: 'ca-bubble-total', text: String(step.total) }));
      bubble.appendChild(expr);
      if (terms.some(function (v) { return set.digits[v].label !== String(v); })) {
        // Show what the digits are worth, so "A + F" or "Frog + Pig" make sense.
        var worth = terms.map(String).join(' + ') + ' = ' + step.total;
        bubble.appendChild(U.el('div', { class: 'ca-bubble-worth', text: worth }));
      }
      if (step.carryOut) {
        bubble.appendChild(U.el('div', { class: 'ca-bubble-note' },
          U.el('span', { text: 'write ' }), sym(step.digit, 'ca-note-sym'),
          U.el('span', { text: ' carry ' }), sym(1, 'ca-note-sym')));
      }
    }

    function writeResult(step) {
      U.clear(resultCells[step.power]);
      var s = sym(step.digit, 'ca-result-sym');
      resultCells[step.power].appendChild(s);
      resultCells[step.power].classList.add('is-filled');
      return s;
    }

    function placeCarry(step) {
      var target = carryCells[step.power + 1];
      U.clear(target);
      var s = sym(1, 'ca-carry-sym');
      target.appendChild(s);
      target.classList.add('is-filled');
      return s;
    }

    function sound(ctx, name) { if (ctx && ctx.sound) ctx.sound(name); }
    // A digit's own sound (an animal's noise) or the fallback.
    function digitSound(ctx, v, fallback) {
      var d = set.digits[v];
      sound(ctx, d && d.sound ? d.sound : fallback);
    }

    // Keyframes for each carry flavor, from offset (dx, dy) back to the carry cell (0, 0).
    function hopFrames(dx, dy) {
      function t(x, y, extra) { return 'translate(' + x + 'px, ' + y + 'px) ' + (extra || ''); }
      var lift = Math.max(40, Math.abs(dx) * 0.6);
      var top = Math.min(dy, 0) / 2 - lift;
      switch (hopStyle) {
        case 'leap': // an animal jumps: crouch, big leap, squash on landing
          return { duration: 1000, easing: 'linear', frames: [
            { transform: t(dx, dy, 'scale(1, 1)') },
            { transform: t(dx, dy + 6, 'scale(1.2, .75)'), offset: 0.12 },
            { transform: t(dx * 0.6, top * 1.6, 'scale(.9, 1.2) rotate(-14deg)'), offset: 0.45 },
            { transform: t(dx * 0.15, top * 0.6, 'scale(1, 1.05) rotate(6deg)'), offset: 0.72 },
            { transform: t(0, 0, 'scale(1.25, .75)'), offset: 0.86 },
            { transform: t(0, 0, 'scale(1, 1)') }] };
        case 'bounce': // a ball: an arc, then two little bounces
          return { duration: 1100, easing: 'linear', frames: [
            { transform: t(dx, dy) },
            { transform: t(dx / 2, top), offset: 0.35 },
            { transform: t(0, 0, 'scale(1.15, .85)'), offset: 0.6 },
            { transform: t(0, -lift * 0.45), offset: 0.74 },
            { transform: t(0, 0, 'scale(1.1, .9)'), offset: 0.86 },
            { transform: t(0, -lift * 0.15), offset: 0.93 },
            { transform: t(0, 0) }] };
        case 'spin': // a twirl through the air
          return { duration: 900, easing: 'ease-in-out', frames: [
            { transform: t(dx, dy, 'rotate(0deg) scale(1)') },
            { transform: t(dx / 2, top, 'rotate(200deg) scale(1.3)'), offset: 0.5 },
            { transform: t(0, 0, 'rotate(360deg) scale(1)') }] };
        case 'flip': // a switch: flips over like a light switch on its way up
          return { duration: 850, easing: 'ease-in-out', frames: [
            { transform: t(dx, dy, 'rotateX(0deg)') },
            { transform: t(dx / 2, top, 'rotateX(180deg) scale(1.25)'), offset: 0.5 },
            { transform: t(0, 0, 'rotateX(360deg)') }] };
        case 'wobble': // a wobbly alien hop
          return { duration: 950, easing: 'ease-in-out', frames: [
            { transform: t(dx, dy, 'rotate(0deg)') },
            { transform: t(dx * 0.7, top * 0.8, 'rotate(-18deg) scale(1.2)'), offset: 0.3 },
            { transform: t(dx * 0.3, top, 'rotate(18deg) scale(1.2)'), offset: 0.6 },
            { transform: t(0, 0, 'rotate(-8deg)'), offset: 0.85 },
            { transform: t(0, 0, 'rotate(0deg)') }] };
        default: // 'arc'
          return { duration: 750, easing: 'ease-in-out', frames: [
            { transform: t(dx, dy, 'scale(1)') },
            { transform: t(dx / 2, top, 'scale(1.25) rotate(-12deg)'), offset: 0.5 },
            { transform: t(0, 0, 'scale(1) rotate(0deg)') }] };
      }
    }

    // The carry travels from one element's position to its final cell.
    function hop(carry, fromEl, ctx) {
      var to = carry.getBoundingClientRect();
      var from = fromEl.getBoundingClientRect();
      var dx = (from.left + from.width / 2) - (to.left + to.width / 2);
      var dy = (from.top + from.height / 2) - (to.top + to.height / 2);
      var h = hopFrames(dx, dy);
      return A.run(carry, h.frames, { duration: h.duration, easing: h.easing }, ctx);
    }

    // Part 1: light the column and show what its digits add up to.
    function showSum(step, ctx) {
      activate(step.power);
      showBubble(step);
      el.dataset.step = String(step.column);
      return A.pop(bubble, ctx);
    }

    // Part 2: write the answer digit (a final carry drops down into its new place).
    function writeDigit(step, ctx) {
      ctx = ctx || {};
      var col = step.power;
      activate(col);
      var mark = carryCells[col].firstChild;
      if (mark && (step.carryIn || step.finalCarry)) mark.classList.add('is-used');
      var r = writeResult(step);
      var done;
      if (step.finalCarry && mark) {
        done = A.run(r, [{ transform: 'translateY(-160%)' }, { transform: 'translateY(0%)' }], { duration: 500, easing: 'ease-in' }, ctx)
          .then(function () { sound(ctx, 'ding'); });
      } else {
        digitSound(ctx, step.digit, 'pop');
        done = A.pop(r, ctx);
      }
      return done.then(function () {
        if (!step.carryOut) finish(step);
      });
    }

    // Part 3: the carry travels to the top of the next column (only when the column carries).
    function carry(step, ctx) {
      if (!step.carryOut) { finish(step); return Promise.resolve(); }
      var c = placeCarry(step);
      sound(ctx, 'carry');
      return hop(c, resultCells[step.power], ctx).then(function () {
        if (set.digits[1].sound) digitSound(ctx, 1);
        finish(step);
      });
    }

    function finish(step) {
      colBg[step.power].classList.add('is-done');
      played = Math.max(played, lay.steps.indexOf(step) + 1);
    }

    function playStep(step, ctx) {
      ctx = ctx || {};
      return showSum(step, ctx)
        .then(function () { return step.finalCarry ? null : A.wait(450, ctx); })
        .then(function () { return writeDigit(step, ctx); })
        .then(function () { return carry(step, ctx); });
    }

    function reset() {
      played = 0;
      bubble.hidden = true;
      U.clear(bubble);
      choices.hidden = true;
      U.clear(choices);
      delete el.dataset.step;
      resultCells.concat(carryCells).forEach(function (c) { U.clear(c); c.classList.remove('is-filled'); });
      colBg.forEach(function (bgEl) { bgEl.classList.remove('is-active', 'is-done'); });
    }

    // Choice buttons: every digit for small bases, otherwise the answer plus a few neighbors.
    function choiceValues(answer) {
      var base = set.base;
      if (base <= 10) return U.range(base);
      var picks = [answer];
      var offsets = [1, -1, 2, -2, 3, -3, 5];
      for (var k = 0; picks.length < 6 && k < offsets.length; k++) {
        var v = answer + offsets[k];
        if (v >= 0 && v < base && picks.indexOf(v) < 0) picks.push(v);
      }
      return picks.sort(function (x, y) { return x - y; });
    }

    // Ask the child for this column's answer digit. Resolves (after animating the step) when
    // they pick the right one. opts: {onWrong(value), onRight(value)}.
    function ask(step, ctx, o) {
      ctx = ctx || {};
      o = o || {};
      if (ctx.instant) return playStep(step, ctx);
      activate(step.power);
      U.clear(choices);
      choices.hidden = false;
      return new Promise(function (resolve, reject) {
        function cleanup() {
          choices.hidden = true;
          U.clear(choices);
          if (ctx.signal) ctx.signal.removeEventListener('abort', onAbort);
        }
        function onAbort() { cleanup(); reject(U.abortError()); }
        if (ctx.signal) {
          if (ctx.signal.aborted) { onAbort(); return; }
          ctx.signal.addEventListener('abort', onAbort, { once: true });
        }
        choiceValues(step.digit).forEach(function (v) {
          var btn = U.el('button', {
            type: 'button', class: 'ca-choice', 'aria-label': set.digits[v].speak,
            onClick: function () {
              if (v === step.digit) {
                cleanup();
                if (o.onRight) o.onRight(v);
                playStep(step, ctx).then(resolve, reject);
              } else {
                btn.classList.add('is-wrong');
                btn.disabled = true;
                sound(ctx, 'click');
                A.wiggle(btn, { reducedMotion: ctx.reducedMotion }).catch(function () {});
                if (o.onWrong) o.onWrong(v);
              }
            }
          }, sym(v));
          choices.appendChild(btn);
        });
      });
    }

    var api = {
      el: el,
      digitSet: set,
      a: a,
      b: b,
      steps: lay.steps,
      layout: lay,
      get played() { return played; },
      playStep: playStep,
      showSum: showSum,
      writeDigit: writeDigit,
      carry: carry,
      hideSum: function () { bubble.hidden = true; U.clear(bubble); },
      next: function (ctx) {
        if (played >= lay.steps.length) return Promise.resolve(false);
        return playStep(lay.steps[played], ctx).then(function () { return true; });
      },
      playAll: function (ctx, o) {
        var gap = (o && o.gap) || 500;
        var chain = Promise.resolve();
        lay.steps.slice(played).forEach(function (step, k) {
          chain = chain.then(function () { return k ? A.wait(gap, ctx) : null; })
            .then(function () { return playStep(step, ctx); });
        });
        return chain;
      },
      ask: ask,
      reset: reset,
      // Highlight one column (power) without playing it; null clears.
      focusColumn: function (power) { activate(power); },
      resultEl: function () { return resultCells; },
      destroy: function () { if (el.parentNode) el.parentNode.removeChild(el); }
    };
    return api;
  }

  NS.columnAdd = { create: create, layout: layout };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
