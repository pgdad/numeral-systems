// Lesson 4: Silly Number Systems (docs/plan/CONTENT.md § Lesson 4).
// Digits are just symbols we agree on: animals count in base five (Cat, Dog, Frog, Pig, Duck), colors count
// in base three (red, yellow, green, each with its own shape and name) -> the "costume wheel": one number,
// written six ways -> "You try it!": animal and color counters, a costume wheel for any number, and a quiz.
//
// The digit sets are fixed by DECISIONS D6. Every animal that appears or changes plays its sound (sound.js),
// and the narration uses NS.digitsets.speak for the animal and color names, so text and digits can't disagree.
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

  // How a number is read in a system: "Frog-Pig", "yellow-yellow-yellow", "one-one-zero-one".
  // Decimal is read digit by digit too ("one-three"), because here we talk about how it is *written*.
  function spell(n, set) {
    if (set === 'decimal') return NS.numeral.toDigits(n, 10).map(function (d) { return words(d); }).join('-');
    return D.speak(n, set);
  }

  // "Dog-Dog is six."
  function isLine(n, set) { return cap(D.speak(n, set)) + ' is ' + words(n) + '.'; }

  // One sentence per number, for counting lines: "Cat. Dog. Frog." (DECISIONS D15).
  function countLine(from, to, set) {
    return U.range(from, to + 1).map(function (n) { return cap(D.speak(n, set)) + '.'; }).join(' ');
  }

  // What the places add up to, in words: valueParts(13, 'animals') -> "two fives, plus three".
  // {ones: true} names the ones place too: "two nines, plus two threes, plus two ones".
  function valueParts(n, set, o) {
    var base = D.resolve(set).base;
    var digits = NS.numeral.toDigits(n, base);
    var parts = [];
    digits.forEach(function (d, i) {
      var power = digits.length - 1 - i;
      if (!d) return;
      if (power === 0) parts.push(words(d) + (o && o.ones ? (d === 1 ? ' one' : ' ones') : ''));
      else parts.push(words(d) + ' ' + D.placeName(power, base, { plural: d !== 1 }).toLowerCase());
    });
    return parts.length ? parts.join(', plus ') : 'zero';
  }

  // "Dog-Duck is one five, plus four. That makes nine!"
  function explain(n, set) {
    var head = cap(D.speak(n, set)) + ' is ';
    if (n < D.resolve(set).base) return head + words(n) + '.';
    return head + valueParts(n, set) + '. That makes ' + words(n) + '!';
  }

  // The costume wheel: the same number in six systems.
  var COSTUMES = [
    { set: 'decimal', name: 'Base‑10', intro: "In base ten, it's " },
    { set: 'binary', name: 'Binary', intro: 'In binary, ' },
    { set: 'octal', name: 'Octal', intro: 'In octal, ' },
    { set: 'hex', name: 'Hex', intro: 'In hex, ' },
    { set: 'animals', name: 'Animals', intro: 'With animals, ' },
    { set: 'colors', name: 'Colors', intro: 'With colors, ' }
  ];
  function costumeSentence(n, costume) { return costume.intro + spell(n, costume.set) + '.'; }

  // The counters in "You try it!" stop at three places: Duck-Duck-Duck and green-green-green.
  var ANIMAL_MAX = 124, COLOR_MAX = 26, WHEEL_MAX = 124;
  function counterNext(n, delta, max) { return U.clamp(n + delta, 0, max); }

  // The digits read as if they were base-ten digits: Dog-Duck (1, 4) -> 14. A favorite mistake, so a good wrong answer.
  function misread(n, set) {
    return parseInt(NS.numeral.toDigits(n, D.resolve(set).base).join(''), 10);
  }

  // Multiple-choice answers: always the answer, no duplicates, all within [min, max], sorted.
  // o: {min, max, count (3), rand (Math.random), prefer: [good wrong answers, used first]}.
  // When the range is too small for `count` choices, every number in the range is offered.
  function makeChoices(answer, o) {
    o = o || {};
    var min = o.min === undefined ? 0 : o.min;
    var max = o.max === undefined ? Math.max(answer + 5, 10) : o.max;
    var count = o.count || 3;
    var rand = o.rand || Math.random;
    var picks = [answer];
    function ok(v) { return v >= min && v <= max && v === Math.floor(v) && picks.indexOf(v) < 0; }
    function take(v) { if (picks.length < count && ok(v)) picks.push(v); }
    (o.prefer || []).forEach(take);
    var near = [1, -1, 2, -2, 3, -3, 5, -5].map(function (d) { return answer + d; }).filter(ok);
    while (picks.length < count && near.length) take(near.splice(Math.floor(rand() * near.length), 1)[0]);
    for (var v = min; picks.length < count && v <= max; v++) take(v);
    return picks.sort(function (a, b) { return a - b; });
  }

  // Quiz question `index`: the first one is always "What number is Dog-Duck?" (9), then animals and colors take turns.
  var QUIZ_RANGES = { animals: [5, 24], colors: [3, 26] };
  function quizQuestion(index, rand) {
    rand = rand || Math.random;
    var set = index % 2 === 0 ? 'animals' : 'colors';
    var r = QUIZ_RANGES[set];
    var value = index === 0 ? 9 : r[0] + Math.floor(rand() * (r[1] - r[0] + 1));
    return {
      set: set, value: value,
      text: 'What number is ' + cap(D.speak(value, set)) + '?',
      choices: makeChoices(value, { min: 0, max: 99, count: 3, rand: rand, prefer: [misread(value, set)] })
    };
  }

  var PRAISE = ['Yes!', 'You got it!', 'Great job!', 'Super!', 'Wow, well done!'];
  var FIRST_COUNT = 4;   // 4.1 counts Cat .. Duck, then Dog-Cat is five
  var FROG_PIG = 13, GREEN3 = 26, COSTUME_N = 13;

  // ---------- Small widgets ----------

  function sound(ctx, name) { if (ctx.sound) ctx.sound(name); }
  // An animal makes its noise; anything else just pops.
  function digitSound(ctx, set, v) {
    var d = D.resolve(set).digits[v];
    sound(ctx, d && d.sound ? d.sound : 'pop');
  }
  // The sound of a number's ones digit (the one that just changed when counting).
  function onesSound(ctx, set, n) { digitSound(ctx, set, n % D.resolve(set).base); }

  // A digit tile turns over and comes back as a digit of another set (0 -> Cat).
  function morph(tile, set, v, ctx) {
    if (ctx.instant || ctx.reducedMotion) {
      tile.setDigitSet(set, v);
      return ctx.signal && ctx.signal.aborted ? Promise.reject(U.abortError()) : Promise.resolve();
    }
    function finish() { tile.el.style.transform = ''; if (tile.digitSet.id !== set) tile.setDigitSet(set, v); }
    return A.run(tile.el, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(90deg)' }], { duration: 200, easing: 'ease-in' }, ctx)
      .then(function () {
        tile.setDigitSet(set, v);
        digitSound(ctx, set, v);
        return A.run(tile.el, [{ transform: 'rotateY(-90deg) scale(1.15)' }, { transform: 'rotateY(0deg) scale(1)' }],
          { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' }, ctx);
      })
      .then(finish, function (e) { finish(); throw e; });
  }

  // A symbol with its name underneath (animals and colors never rely on the picture alone).
  function namedSymbol(set, v, cls) {
    var d = D.resolve(set).digits[v];
    var sym = NS.symbols.renderValue(v, set);
    sym.setAttribute('aria-hidden', 'true');
    sym.removeAttribute('role');
    return U.el('span', { class: ['sl-named', cls] }, sym, U.el('span', { class: 'sl-named-label', text: d.label }));
  }

  // How a number looks in one costume: text for text sets, named symbols for animals and colors.
  function costumeFace(n, set) {
    var s = D.resolve(set);
    if (s.kind === 'text') return U.el('span', { class: 'sl-costume-text', text: NS.numeral.format(n, s) });
    return U.el('span', { class: 'sl-costume-syms' }, NS.numeral.toDigits(n, s.base).map(function (v) { return namedSymbol(s, v); }));
  }

  // One card per costume. update(n) redraws all of them.
  function costumeCards(n) {
    var cards = COSTUMES.map(function (c) {
      var face = U.el('span', { class: 'sl-costume-face' });
      var card = U.el('div', { class: ['sl-costume', 'theme-' + D.resolve(c.set).theme], role: 'img', dataset: { costume: c.set } },
        U.el('span', { class: 'sl-costume-name', text: c.name }), face);
      return { costume: c, card: card, face: face };
    });
    function update(v) {
      cards.forEach(function (x) {
        U.clear(x.face);
        x.face.appendChild(costumeFace(v, x.costume.set));
        x.card.setAttribute('aria-label', x.costume.name + ': ' + spell(v, x.costume.set));
      });
    }
    update(n);
    return { cards: cards, update: update };
  }

  // An odometer with an "= n" decimal readout beside it.
  function counterBox(set, places, value, o) {
    o = o || {};
    var odo = NS.odometer.create({ set: set, places: places, value: value, labels: 'names', size: o.size || 'lg',
      carryHop: true, dimLeading: true });
    var dec = U.el('span', { class: 'sl-dec-num', text: String(value) });
    var el = U.el('div', { class: ['sl-countbox', 'theme-' + odo.digitSet.theme, o.class] }, odo.el,
      U.el('span', { class: 'sl-dec' }, U.el('span', { class: 'sl-eq', text: '=' }), dec));
    function showDec(n, ctx) {
      dec.textContent = String(n);
      return A.pop(dec, ctx, { duration: 300 });
    }
    return {
      el: el, odo: odo, dec: dec, showDec: showDec,
      step: function (dir, ctx) {
        var n = odo.value + dir;
        return A.parallel(odo.step(dir, ctx), showDec(n, ctx));
      },
      set: function (n, ctx) { return A.parallel(odo.set(n, ctx), showDec(n, ctx)); }
    };
  }

  // Count up by one on cue: the counter steps and the new ones-digit animal makes its noise. When the ones place
  // rolls over, the carry jumps (odometer carryHop) and the digit it lands on makes the noise instead.
  function countOnCue(ctx, box, cue, set) {
    return ctx.cue(cue).then(function () {
      var base = D.resolve(set).base;
      var next = box.odo.value + 1;
      if (next % base) { onesSound(ctx, set, next); return box.step(1, ctx); }
      return box.step(1, ctx).then(function () { digitSound(ctx, set, Math.floor(next / base) % base); });
    });
  }

  // Stars that shoot out of `layer` and fade (transient: nothing is left behind).
  function burst(layer, ctx, count) {
    if (ctx.instant) return Promise.resolve();
    var n = ctx.reducedMotion ? 1 : (count || 10);
    var box = U.el('div', { class: 'sl-burst', 'aria-hidden': 'true' });
    U.range(n).forEach(function (i) {
      var star = NS.icons.render('star', { class: 'sl-burst-star' });
      star.style.setProperty('--a', (i * 360 / n) + 'deg');
      box.appendChild(star);
    });
    layer.appendChild(box);
    function done() { if (box.parentNode) box.parentNode.removeChild(box); }
    return A.wait(1500, ctx).then(done, function (e) { done(); throw e; });
  }

  // ---------- 4.1 Digits can be anything! ----------

  var anything = {
    id: 'anything',
    title: 'Digits can be anything!',
    setup: function (stage) {
      var cells = U.range(5).map(function (v) {
        var tile = NS.digitTile.create({ set: 'decimal', value: v, size: 'lg', caption: true });
        hidden(tile.el);
        var tag = hidden(U.el('span', { class: 'sl-tag', text: '= ' + v }));
        return { tile: tile, tag: tag, cell: U.el('span', { class: 'sl-cell' }, tile.el, tag) };
      });
      var badge = hidden(U.el('div', { class: 'sl-badge' },
        U.el('span', { class: 'sl-badge-big', text: '5' }), U.el('span', { text: ' animals → base 5' })));
      var root = U.el('div', { class: 'sl-scene sl-anything' },
        U.el('div', { class: 'sl-cells' }, cells.map(function (c) { return c.cell; })), badge);
      stage.appendChild(root);
      return { cells: cells, badge: badge };
    },
    steps: [
      {
        say: 'Digits are just symbols that we agree on. They could be anything. Even pictures!',
        do: function (ctx) {
          var s = ctx.state;
          return A.stagger(s.cells, function (c) {
            sound(ctx, 'pop');
            return c.tile.pop(ctx);
          }, 150, ctx).then(function () { return ctx.cue(1); }).then(function () {
            return A.stagger(s.cells, function (c) { return c.tile.wiggle(ctx); }, 90, ctx);
          }).then(function () { return ctx.cue(2); }).then(function () {
            return A.stagger(s.cells, function (c, v) { return morph(c.tile, 'animals', v, ctx); }, 420, ctx);
          });
        }
      },
      {
        say: 'Meet the animal numbers! ' + U.range(5).map(function (v) {
          return D.digitName(v, 'animals') + ' is ' + words(v) + '.';
        }).join(' '),
        do: function (ctx) {
          var s = ctx.state;
          var chain = Promise.resolve();
          s.cells.forEach(function (c, v) {
            chain = chain.then(function () { return ctx.cue(v + 1); }).then(function () {
              digitSound(ctx, 'animals', v);
              c.tile.setLit(true);
              return A.parallel(c.tile.bounce(ctx), A.pop(c.tag, ctx));
            });
          });
          return chain;
        }
      },
      {
        say: "Five animals means we're counting in base five.",
        do: function (ctx) {
          var s = ctx.state;
          return A.stagger(s.cells, function (c) { return c.tile.glow(ctx); }, 120, ctx).then(function () {
            sound(ctx, 'ding');
            return A.pop(s.badge, ctx);
          });
        }
      }
    ]
  };

  // ---------- 4.2 Counting with animals ----------

  var countAnimals = {
    id: 'animals',
    title: 'Counting with animals',
    setup: function (stage) {
      var box = counterBox('animals', 2, 0);
      hidden(box.el);
      var pv = NS.placeValue.create({ set: 'animals', value: FROG_PIG, places: 2, arrows: true, units: true, tileSize: 'sm', class: 'sl-pv' });
      hidden(pv.el);
      var root = U.el('div', { class: 'sl-scene sl-count' }, box.el, pv.el);
      stage.appendChild(root);
      return { box: box, pv: pv };
    },
    steps: [
      {
        say: "Let's count! " + countLine(0, FIRST_COUNT, 'animals'),
        do: function (ctx) {
          var s = ctx.state;
          sound(ctx, 'whoosh');
          var chain = A.pop(s.box.el, ctx).then(function () { return ctx.cue(1); }).then(function () {
            digitSound(ctx, 'animals', 0);
            return A.bounce(s.box.odo.placeEl(0), ctx);
          });
          U.range(2, FIRST_COUNT + 2).forEach(function (k) {
            chain = chain.then(function () { return countOnCue(ctx, s.box, k, 'animals'); });
          });
          return chain;
        }
      },
      {
        say: 'We ran out of animals! So a Dog jumps into the next place, and the ones place starts again at Cat. ' +
          cap(D.speak(FIRST_COUNT + 1, 'animals')) + ' means ' + words(FIRST_COUNT + 1) + '!',
        do: function (ctx) {
          var s = ctx.state;
          return A.parallel(A.wiggle(s.box.odo.placeEl(0), ctx), s.box.odo.highlightPlace(0, ctx)).then(function () {
            return ctx.cue(1);
          }).then(function () {
            return s.box.odo.set(FIRST_COUNT + 1, ctx);
          }).then(function () {
            digitSound(ctx, 'animals', 1);
            return s.box.odo.highlightPlace(1, ctx);
          }).then(function () { return ctx.cue(2); }).then(function () {
            sound(ctx, 'ding');
            return A.parallel(s.box.showDec(FIRST_COUNT + 1, ctx), A.highlight(s.box.dec, ctx));
          });
        }
      },
      {
        say: [6, 7, 8, 9].map(function (n) { return isLine(n, 'animals'); }).join(' ') + ' And then? ' +
          cap(D.speak(10, 'animals')) + ' is ' + words(10) + '!',
        do: function (ctx) {
          var s = ctx.state;
          var chain = Promise.resolve();
          [0, 1, 2, 3].forEach(function (k) { chain = chain.then(function () { return countOnCue(ctx, s.box, k, 'animals'); }); });
          return chain.then(function () { return ctx.cue(4); }).then(function () {
            return A.parallel(A.wiggle(s.box.odo.placeEl(0), ctx), s.box.odo.highlightPlace(0, ctx));
          }).then(function () { return countOnCue(ctx, s.box, 5, 'animals'); });
        }
      },
      {
        say: "What's " + cap(D.speak(FROG_PIG, 'animals')) + '? Two fives. Plus three more. That makes ' + words(FROG_PIG) + '!',
        do: function (ctx) {
          var s = ctx.state;
          return s.box.odo.runTo(FROG_PIG, ctx, {
            msPerStep: 450,
            onStep: function (e) { s.box.dec.textContent = String(e.n); if (!ctx.instant) onesSound(ctx, 'animals', e.n); }
          }).then(function () {
            sound(ctx, 'whoosh');
            return A.pop(s.pv.el, ctx);
          }).then(function () { return ctx.cue(1); }).then(function () {
            sound(ctx, 'ribbit');
            return s.pv.highlightPlace(1, ctx);
          }).then(function () { return ctx.cue(2); }).then(function () {
            sound(ctx, 'oink');
            return s.pv.highlightPlace(0, ctx);
          }).then(function () { return ctx.cue(3); }).then(function () {
            sound(ctx, 'ding');
            return s.pv.expand(ctx);
          }).then(function () { return A.highlight(s.pv.el.querySelector('.pv-total'), ctx); });
        }
      }
    ]
  };

  // ---------- 4.3 Color numbers ----------

  var colorNumbers = {
    id: 'colors',
    title: 'Color numbers',
    setup: function (stage) {
      var lamps = U.range(3).map(function (v) {
        var tag = hidden(U.el('span', { class: 'sl-tag', text: '= ' + v }));
        var lamp = U.el('div', { class: 'sl-lamp', dataset: { value: String(v) } }, namedSymbol('colors', v, 'sl-lamp-sym'), tag);
        return { lamp: lamp, tag: tag };
      });
      var light = hidden(U.el('div', { class: 'sl-light', role: 'img', 'aria-label': 'Traffic light: red circle, yellow triangle, green square' },
        lamps.map(function (l) { return l.lamp; })));
      var box = counterBox('colors', 3, 0);
      hidden(box.el);
      var pv = NS.placeValue.create({ set: 'colors', value: 6, places: 3, arrows: true, tileSize: 'sm', class: 'sl-pv' });
      hidden(pv.el);
      var root = U.el('div', { class: 'sl-scene sl-colors' },
        U.el('div', { class: 'sl-row' }, light, U.el('div', { class: 'sl-colors-right' }, box.el, pv.el)));
      stage.appendChild(root);
      return { lamps: lamps, light: light, box: box, pv: pv };
    },
    steps: [
      {
        say: "Now let's count with colors! " + U.range(3).map(function (v) {
          return cap(D.digitName(v, 'colors')) + ' is ' + words(v) + '.';
        }).join(' '),
        do: function (ctx) {
          var s = ctx.state;
          sound(ctx, 'pop');
          var chain = A.pop(s.light, ctx);
          s.lamps.forEach(function (l, v) {
            chain = chain.then(function () { return ctx.cue(v + 1); }).then(function () {
              sound(ctx, 'ding');
              l.lamp.classList.add('is-on');
              return A.parallel(A.bounce(l.lamp, ctx), A.pop(l.tag, ctx));
            });
          });
          return chain;
        }
      },
      {
        say: "Only three colors means base three. Let's count! " + countLine(0, 6, 'colors'),
        do: function (ctx) {
          var s = ctx.state;
          var chain = A.stagger(s.lamps, function (l) { return A.highlight(l.lamp, ctx); }, 150, ctx)
            .then(function () { return ctx.cue(1); }).then(function () {
              sound(ctx, 'whoosh');
              return A.pop(s.box.el, ctx);
            }).then(function () { return ctx.cue(2); }).then(function () {
              sound(ctx, 'pop');
              return A.bounce(s.box.odo.placeEl(0), ctx);
            });
          U.range(3, 9).forEach(function (k) {
            chain = chain.then(function () { return countOnCue(ctx, s.box, k, 'colors'); });
          });
          return chain;
        }
      },
      {
        say: 'Each place is worth three times more than the one before. Ones. Threes. Nines.',
        do: function (ctx) {
          var s = ctx.state;
          sound(ctx, 'whoosh');
          var chain = A.pop(s.pv.el, ctx);
          [0, 1, 2].forEach(function (power, k) {
            chain = chain.then(function () { return ctx.cue(k + 1); }).then(function () {
              sound(ctx, 'pop');
              return s.pv.highlightPlace(power, ctx);
            });
          });
          return chain;
        }
      },
      {
        say: cap(D.speak(GREEN3, 'colors')) + ' is ' + valueParts(GREEN3, 'colors', { ones: true }) + '. That makes ' + words(GREEN3) + '!',
        do: function (ctx) {
          var s = ctx.state;
          sound(ctx, 'whoosh');
          return A.parallel(s.box.set(GREEN3, ctx), s.pv.set(GREEN3, ctx)).then(function () {
            return A.stagger([2, 1, 0], function (power) {
              sound(ctx, 'pop');
              return s.pv.highlightPlace(power, ctx);
            }, 550, ctx);
          }).then(function () { return ctx.cue(1); }).then(function () {
            sound(ctx, 'tada');
            return s.pv.expand(ctx);
          }).then(function () { return A.highlight(s.pv.el.querySelector('.pv-total'), ctx); });
        }
      }
    ]
  };

  // ---------- 4.4 Same number, many costumes ----------

  // A ring of n dots: the amount itself, before anyone writes it down.
  function dotRing(n) {
    var dots = U.range(n).map(function (i) {
      var a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return U.svg('circle', { class: 'sl-dot', cx: (50 + 40 * Math.cos(a)).toFixed(1), cy: (50 + 40 * Math.sin(a)).toFixed(1), r: 6.5 });
    });
    return U.svg('svg', { class: 'sl-dots', viewBox: '0 0 100 100', 'aria-hidden': 'true' }, dots);
  }

  var costumes = {
    id: 'costumes',
    title: 'Same number, many costumes',
    setup: function (stage) {
      var center = hidden(U.el('div', { class: 'sl-center', role: 'img', 'aria-label': 'The number ' + words(COSTUME_N) },
        dotRing(COSTUME_N), U.el('span', { class: 'sl-center-word', text: words(COSTUME_N) })));
      var set = costumeCards(COSTUME_N);
      var spots = set.cards.map(function (x, i) {
        hidden(x.card);
        return U.el('div', { class: 'sl-spot sl-spot-' + i }, x.card);
      });
      var wheel = U.el('div', { class: 'sl-wheel' }, center, spots);
      stage.appendChild(U.el('div', { class: 'sl-scene sl-costumes' }, wheel));
      return { center: center, cards: set.cards };
    },
    steps: [
      {
        say: 'The number ' + words(COSTUME_N) + ' can wear lots of costumes!',
        do: function (ctx) {
          var s = ctx.state;
          sound(ctx, 'pop');
          return A.pop(s.center, ctx).then(function () { return A.wiggle(s.center, ctx); });
        }
      },
      {
        say: COSTUMES.map(function (c) { return costumeSentence(COSTUME_N, c); }).join(' '),
        do: function (ctx) {
          var s = ctx.state;
          var chain = Promise.resolve();
          s.cards.forEach(function (x, k) {
            chain = chain.then(function () { return ctx.cue(k); }).then(function () {
              var set = x.costume.set;
              if (set === 'animals') onesSound(ctx, set, COSTUME_N); else sound(ctx, 'pop');
              if (ctx.instant || ctx.reducedMotion) return A.fadeIn(x.card, ctx);
              var c = s.center.getBoundingClientRect(), r = x.card.getBoundingClientRect();
              var dx = (c.left + c.width / 2) - (r.left + r.width / 2), dy = (c.top + c.height / 2) - (r.top + r.height / 2);
              return A.run(x.card, [
                { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(.2)', opacity: 0 },
                { transform: 'translate(0px, 0px) scale(1)', opacity: 1 }
              ], { duration: 650 }, ctx);
            });
          });
          return chain;
        }
      },
      {
        say: "The number doesn't change. Only the way we write it! " + cap(words(COSTUME_N)) + ' is always ' + words(COSTUME_N) + '.',
        do: function (ctx) {
          var s = ctx.state;
          if (ctx.instant) return Promise.resolve();
          sound(ctx, 'whoosh');
          var c = s.center.getBoundingClientRect();
          // Every costume spins into the middle and back out again (nothing changes for good).
          return A.parallel.apply(null, s.cards.map(function (x) {
            var r = x.card.getBoundingClientRect();
            var dx = (c.left + c.width / 2) - (r.left + r.width / 2), dy = (c.top + c.height / 2) - (r.top + r.height / 2);
            return A.run(x.card, [
              { transform: 'translate(0px, 0px) scale(1) rotate(0deg)' },
              { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(.25) rotate(360deg)', offset: 0.45 },
              { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(.25) rotate(360deg)', offset: 0.6 },
              { transform: 'translate(0px, 0px) scale(1) rotate(720deg)' }
            ], { duration: 2200, easing: 'ease-in-out' }, ctx, 'transient');
          }).concat([ctx.wait(1000).then(function () {
            sound(ctx, 'ding');
            return A.parallel(A.bounce(s.center, ctx), A.highlight(s.center, ctx));
          })])).then(function () { return ctx.cue(1); }).then(function () {
            return ctx.cue(2);
          }).then(function () {
            sound(ctx, 'tada');
            return A.stagger(s.cards, function (x) { return A.highlight(x.card, ctx); }, 120, ctx);
          });
        }
      }
    ]
  };

  // ---------- 4.5 You try it! ----------

  var tryIt = {
    id: 'try',
    title: 'You try it!',
    interactive: true,
    setup: function (stage, setupCtx) {
      var ctrl = new AbortController();
      var signal = ctrl.signal;
      var live = { speed: 1, reducedMotion: setupCtx.reducedMotion, signal: signal, sound: function (n) { NS.sound.play(n); } };
      var s = { ctrl: ctrl, sayTimer: null, stars: 0, quizIndex: 0, busy: false };

      function say(text) {
        if (signal.aborted) return;
        if (setupCtx.player && setupCtx.player.getMode() === 'playing') return;
        NS.narrator.speak('silly.try.live', text, { signal: signal }).catch(noop);
      }
      function sayLater(text, ms) {
        clearTimeout(s.sayTimer);
        s.sayTimer = setTimeout(function () { say(text); }, ms || 600);
      }

      // --- Counters: animals (0-124) and colors (0-26) with -1 / +1 ---
      function counter(set, max, name) {
        var box = counterBox(set, 3, 0, { size: 'md', class: 'sl-try-count' });
        var value = 0;
        var read = U.el('p', { class: 'sl-read', 'aria-live': 'polite' });
        function button(dir) {
          return U.el('button', { type: 'button', class: ['btn', 'sl-step', dir > 0 ? 'is-up' : ''],
            'aria-label': (dir > 0 ? 'Count up one ' : 'Count down one ') + name,
            dataset: { set: set, delta: String(dir) }, onClick: function () { go(dir); } },
          NS.icons.render(dir > 0 ? 'plus' : 'minus', { kind: 'ui' }));
        }
        var down = button(-1), up = button(1);
        function draw() {
          down.disabled = value <= 0;
          up.disabled = value >= max;
          read.textContent = cap(D.speak(value, set)) + ' = ' + value;
        }
        function go(dir) {
          var next = counterNext(value, dir, max);
          if (next === value) return;
          value = next;
          box.step(dir, live).catch(noop);
          onesSound(live, set, next);
          draw();
          sayLater(cap(D.speak(next, set)) + '. ' + cap(words(next)) + '.', 700);
        }
        draw();
        var el = U.el('div', { class: ['sl-counter', 'theme-' + D.resolve(set).theme] },
          U.el('h3', { class: 'sl-counter-name', text: name }),
          U.el('div', { class: 'sl-counter-row' }, down, box.el, up), read);
        return { el: el, box: box, go: go, get value() { return value; } };
      }
      var animalCounter = counter('animals', ANIMAL_MAX, 'Animals');
      var colorCounter = counter('colors', COLOR_MAX, 'Colors');
      var countPanel = U.el('div', { class: 'sl-tab-panel sl-panel-count' },
        U.el('p', { class: 'sl-tip', text: 'Press + and watch the carry jump: after Duck comes Dog-Cat, after green comes yellow-red!' }),
        U.el('div', { class: 'sl-counters' }, animalCounter.el, colorCounter.el));

      // --- Costume wheel: type any number and see all six costumes ---
      var wheel = costumeCards(COSTUME_N);
      var wheelValue = COSTUME_N;
      var inputId = 'sl-wheel-input';
      var input = U.el('input', { type: 'number', id: inputId, class: 'sl-input', min: '0', max: String(WHEEL_MAX), step: '1',
        inputmode: 'numeric', value: String(wheelValue) });
      function wheelTo(n, fromInput) {
        n = U.clamp(n | 0, 0, WHEEL_MAX);
        if (!fromInput || String(n) !== input.value) input.value = String(n);
        if (n === wheelValue) return;
        wheelValue = n;
        wheel.update(n);
        wheelDown.disabled = n <= 0;
        wheelUp.disabled = n >= WHEEL_MAX;
        onesSound(live, 'animals', n);
        wheel.cards.forEach(function (x) { A.pop(x.face, live, { duration: 250 }).catch(noop); });
        sayLater(cap(words(n)) + '. With animals, ' + D.speak(n, 'animals') + '.', 800);
      }
      input.addEventListener('input', function () {
        var v = parseInt(input.value, 10);
        if (!isNaN(v)) wheelTo(v, true);
      });
      input.addEventListener('change', function () { wheelTo(parseInt(input.value, 10) || 0, false); });
      function wheelButton(dir) {
        return U.el('button', { type: 'button', class: 'btn sl-step', 'aria-label': dir > 0 ? 'One more' : 'One less',
          dataset: { wheel: String(dir) }, onClick: function () { wheelTo(wheelValue + dir, false); } },
        NS.icons.render(dir > 0 ? 'plus' : 'minus', { kind: 'ui' }));
      }
      var wheelDown = wheelButton(-1), wheelUp = wheelButton(1);
      var form = U.el('form', { class: 'sl-wheel-form', novalidate: 'novalidate' },
        U.el('label', { for: inputId, class: 'sl-wheel-label', text: 'Pick a number (0 to ' + WHEEL_MAX + '):' }),
        U.el('span', { class: 'sl-wheel-input-row' }, wheelDown, input, wheelUp));
      form.addEventListener('submit', function (e) { e.preventDefault(); wheelTo(parseInt(input.value, 10) || 0, false); });
      var wheelPanel = U.el('div', { class: 'sl-tab-panel sl-panel-wheel', hidden: true }, form,
        U.el('div', { class: 'sl-wheel is-grid' }, wheel.cards.map(function (x) { return x.card; })));

      // --- Quiz: "What number is Dog-Duck?" ---
      var starCount = U.el('span', { class: 'sl-star-count', text: '0' });
      var prompt = U.el('p', { class: 'sl-prompt', 'aria-live': 'polite' });
      var shown = U.el('div', { class: 'sl-quiz-number' });
      var choiceRow = U.el('div', { class: 'sl-choices', role: 'group', 'aria-label': 'Answers' });
      var feedback = U.el('p', { class: 'sl-feedback', 'aria-live': 'polite' });
      var skip = U.el('button', { type: 'button', class: 'btn sl-skip', onClick: function () { nextQuestion(false); } }, 'Skip');
      var burstLayer = U.el('div', { class: 'sl-burst-anchor', 'aria-hidden': 'true' });
      var quizCard = U.el('div', { class: 'sl-card' },
        U.el('span', { class: 'sl-stars', title: 'Stars' }, NS.icons.render('star', { kind: 'ui', class: 'sl-star-icon' }), starCount),
        prompt, shown, choiceRow, feedback, skip, burstLayer);
      var quizPanel = U.el('div', { class: 'sl-tab-panel sl-panel-quiz', hidden: true }, quizCard);

      function showQuestion() {
        var q = s.question = quizQuestion(s.quizIndex);
        prompt.textContent = q.text;
        U.clear(shown);
        shown.appendChild(costumeFace(q.value, q.set));
        shown.className = 'sl-quiz-number theme-' + D.resolve(q.set).theme;
        feedback.textContent = '';
        quizCard.classList.remove('is-won');
        U.clear(choiceRow);
        q.choices.forEach(function (v) {
          choiceRow.appendChild(U.el('button', { type: 'button', class: 'btn sl-choice', dataset: { value: String(v) },
            onClick: function (e) { answer(v, e.currentTarget); } }, String(v)));
        });
      }
      function answer(v, btn) {
        var q = s.question;
        if (s.busy) return;
        if (v === q.value) {
          s.busy = true;
          s.stars += 1;
          starCount.textContent = String(s.stars);
          btn.classList.add('is-right');
          quizCard.classList.add('is-won');
          NS.sound.play('tada');
          feedback.textContent = explain(q.value, q.set);
          say(PRAISE[(s.stars - 1) % PRAISE.length] + ' ' + explain(q.value, q.set));
          burst(burstLayer, live, 8).catch(noop);
          U.sleep(3200, signal).then(function () { nextQuestion(true); }, noop);
        } else {
          btn.disabled = true;
          btn.classList.add('is-wrong');
          NS.sound.play('click');
          A.wiggle(btn, live).catch(noop);
          feedback.textContent = 'Not ' + v + '. Try again!';
          say('Not quite. Try again!');
        }
      }
      function nextQuestion(won) {
        s.busy = false;
        s.quizIndex += 1;
        if (!won) NS.sound.play('click');
        showQuestion();
        A.pop(prompt, live).catch(noop);
        say(s.question.text);
      }
      showQuestion();

      // --- Tabs ---
      var tabs = {};
      function tab(kind, label, icon) {
        tabs[kind] = U.el('button', { type: 'button', class: 'btn sl-tab', 'aria-pressed': 'false', dataset: { tab: kind },
          onClick: function () { show(kind); } }, NS.icons.render(icon, { class: 'sl-tab-icon' }), U.el('span', { text: label }));
        return tabs[kind];
      }
      function show(kind) {
        countPanel.hidden = kind !== 'count';
        wheelPanel.hidden = kind !== 'wheel';
        quizPanel.hidden = kind !== 'quiz';
        Object.keys(tabs).forEach(function (k) { tabs[k].setAttribute('aria-pressed', String(k === kind)); });
      }
      var tabRow = U.el('div', { class: 'sl-tabs', role: 'group', 'aria-label': 'Choose a toy' },
        tab('count', 'Counters', 'dog'), tab('wheel', 'Costumes', 'unicorn'), tab('quiz', 'Quiz', 'owl'));
      show('count');

      var root = U.el('div', { class: 'sl-scene sl-try' }, tabRow, countPanel, wheelPanel, quizPanel);
      stage.appendChild(root);
      s.tabRow = tabRow;
      s.show = show;
      s.animalCounter = animalCounter;
      s.colorCounter = colorCounter;
      s.wheelTo = wheelTo;
      return s;
    },
    teardown: function (stage, ctx) {
      var s = ctx.state;
      clearTimeout(s.sayTimer);
      if (s.ctrl) s.ctrl.abort();
    },
    steps: [
      {
        say: 'Your turn! Press plus and minus to count with animals and colors. Press Costumes to dress up any number. ' +
          'Or press Quiz: what number is ' + cap(D.speak(9, 'animals')) + '?',
        do: function (ctx) {
          var s = ctx.state;
          var chain = Promise.resolve();
          [0, 1, 2].forEach(function (k) {
            chain = chain.then(function () { return ctx.cue(k + 1); }).then(function () {
              sound(ctx, 'pop');
              return A.highlight(s.tabRow.children[k], ctx);
            });
          });
          return chain;
        }
      }
    ]
  };

  NS.lessons.register({
    id: 'silly',
    order: 40,
    title: 'Silly Number Systems',
    shortTitle: 'Silly systems',
    spokenTitle: 'Silly number systems', // Movie mode chapter card (js/movie.js)
    blurb: 'Numbers made of cats, dogs and frogs, and numbers made of colors.',
    ageHint: '5+',
    theme: 'silly',
    icon: 'frog',
    glyph: 'dots',
    scenes: [anything, countAnimals, colorNumbers, costumes, tryIt],
    // Pure helpers, exposed for unit tests.
    helpers: {
      COSTUMES: COSTUMES, ANIMAL_MAX: ANIMAL_MAX, COLOR_MAX: COLOR_MAX, WHEEL_MAX: WHEEL_MAX, QUIZ_RANGES: QUIZ_RANGES,
      FIRST_COUNT: FIRST_COUNT, FROG_PIG: FROG_PIG, GREEN3: GREEN3, COSTUME_N: COSTUME_N,
      spell: spell, isLine: isLine, countLine: countLine, valueParts: valueParts, explain: explain,
      costumeSentence: costumeSentence, counterNext: counterNext, misread: misread, makeChoices: makeChoices,
      quizQuestion: quizQuestion
    }
  });
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
