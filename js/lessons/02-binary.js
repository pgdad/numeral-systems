// Lesson 2: Binary, count to 1023 on two hands (docs/plan/CONTENT.md § Lesson 2).
// Fingers are switches -> each finger has a value (1, 2, 4 ... 512) -> counting 0..31 -> all ten up = 1023
// -> reading binary numbers (1011 = 11, 10010 = 18) -> a "You try it!" finger sandbox -> "Did you know?".
//
// Finger mapping is DECISIONS D5 (right pinky = 1 ... left pinky = 512). The lesson never *stops* on
// 4 or 128 alone (only the middle finger up); counting passes through them without comment.
// Lesson files must not touch the DOM at load time: everything happens inside setup/do.
(function (NS) {
  'use strict';

  var U = NS.util;
  var A = NS.anim;
  var D = NS.digitsets;

  var FINGERS = 10;
  var MAX = Math.pow(2, FINGERS) - 1; // 1023

  function words(n) { return D.speak(n, 'decimal'); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------- Pure helpers (unit-tested) ----------

  // Values of the raised fingers, biggest first: bitValues(11) -> [8, 2, 1].
  function bitValues(n) {
    var out = [];
    for (var v = Math.pow(2, FINGERS - 1); v >= 1; v /= 2) if (Math.floor(n / v) % 2 === 1) out.push(v);
    return out;
  }

  // Every binary digit's value from the highest raised finger down: placeTerms(11) -> [8, 0, 2, 1].
  function placeTerms(n) {
    var vals = bitValues(n);
    if (!vals.length) return [0];
    var out = [];
    for (var v = vals[0]; v >= 1; v /= 2) out.push(Math.floor(n / v) % 2 === 1 ? v : 0);
    return out;
  }

  // "8 + 2 + 1 = 11" (or with zeros: "8 + 0 + 2 + 1 = 11"). One term is just "16"; nothing up is "0".
  function breakdown(n, withZeros) {
    var terms = withZeros ? placeTerms(n) : bitValues(n);
    if (terms.length <= 1) return String(terms.length ? terms[0] : 0);
    return terms.join(' + ') + ' = ' + n;
  }

  // "eight plus two plus one makes eleven"
  function sayBreakdown(n) {
    var terms = bitValues(n);
    if (terms.length <= 1) return words(n);
    return terms.map(words).join(' plus ') + ' makes ' + words(n);
  }

  // Leading zeros of the 10-finger binary readout (they are drawn dimmer).
  function leadingZeros(n) {
    var bits = NS.hands.bitsToFingers(n, FINGERS);
    var k = 0;
    while (k < FINGERS - 1 && !bits[k]) k++;
    return k;
  }

  // Challenges for "You try it!". {kind: 'age'} asks for the child's age first.
  var CHALLENGES = [
    { kind: 'show', target: 5 },
    { kind: 'show', target: 10 },
    { kind: 'age' },
    { kind: 'show', target: 100 },
    { kind: 'show', target: MAX },
    { kind: 'show', target: 7 },
    { kind: 'show', target: 42 },
    { kind: 'show', target: 512 }
  ];
  var AGE_MAX = 120;

  // D5: never stop on 4 or 128 alone (just the middle finger), so those ages show next year's age.
  function ageTarget(age) {
    if (!Number.isInteger(age) || age < 1 || age > AGE_MAX) return null;
    return age === 4 || age === 128 ? age + 1 : age;
  }

  // state: {bits, age}
  function targetOf(ch, state) {
    if (ch.kind === 'age') return state && state.age ? ageTarget(state.age) : null;
    return ch.target;
  }

  function challengeText(ch, state) {
    var t = targetOf(ch, state);
    if (ch.kind === 'age') {
      if (t === null) return 'How old are you? Type your age, then show it on your fingers!';
      if (t !== state.age) return 'Show ' + words(t) + '. That is how old you will be on your next birthday!';
      return 'You are ' + words(t) + '! Show ' + words(t) + ' on your fingers!';
    }
    if (t === MAX) return 'Show ' + words(t) + '. The biggest one!';
    return 'Show ' + words(t) + ' on your fingers!';
  }

  function isMet(ch, state) {
    var t = targetOf(ch, state);
    return t !== null && state.bits === t;
  }

  // Index of the challenge after `index` that isn't already met (wraps around; -1 starts at the first).
  function nextChallenge(index, state, list) {
    list = list || CHALLENGES;
    for (var k = 1; k <= list.length; k++) {
      var i = (index + k + list.length) % list.length;
      if (!isMet(list[i], state)) return i;
    }
    return (index + 1) % list.length;
  }

  // The numbers the narrated scenes come to rest on (checked against D5 in tests).
  var EXAMPLES = [11, 18];

  var PRAISE = ['Yes!', 'You got it!', 'Great job!', 'Super!', 'Wow, well done!'];

  // ---------- small scene helpers ----------

  function hidden(el) { el.style.opacity = '0'; return el; }

  // Hands with value badges above and a row of binary digits lined up under the fingers.
  //   board.show(n, ctx)   fingers + digits (changed digits flash)
  //   board.digits(n, ctx) digits only (when the fingers were already moved, e.g. by a tap)
  function makeBoard(opts) {
    opts = opts || {};
    var bits = opts.bits || 0;
    var hands = NS.hands.create({ hands: 'both', bits: bits });
    if (opts.labels) hands.labels(true, null, { instant: true });
    var spots = NS.hands.fingerSpots('both');
    var cells = spots.map(function (x) {
      return U.el('span', { class: 'bin-bit', style: { left: (x * 100).toFixed(2) + '%' } });
    });
    var strip = U.el('div', { class: 'bin-strip', role: 'img' }, cells);
    var el = U.el('div', { class: ['bin-board', opts.class] }, hands.el, strip);
    if (opts.strip === false) strip.hidden = true;
    var shown = null;

    function digits(n, ctx) {
      var fingers = NS.hands.bitsToFingers(n, FINGERS);
      var lead = leadingZeros(n);
      var flashes = [];
      cells.forEach(function (c, i) {
        var text = fingers[i] ? '1' : '0';
        var changed = shown !== null && c.textContent !== text;
        c.textContent = text;
        c.classList.toggle('is-one', fingers[i]);
        c.classList.toggle('is-lead', i < lead);
        if (changed) {
          flashes.push(A.run(c, [
            { transform: 'scale(1)', backgroundColor: 'rgba(255, 196, 0, 0)' },
            { transform: 'scale(1.35)', backgroundColor: 'rgba(255, 196, 0, .9)', offset: 0.3 },
            { transform: 'scale(1)', backgroundColor: 'rgba(255, 196, 0, 0)' }
          ], { duration: 500, easing: 'ease-out' }, ctx, 'transient'));
        }
      });
      shown = n;
      strip.setAttribute('aria-label', 'Binary ' + NS.hands.bitsToFingers(n, FINGERS).map(function (b) { return b ? '1' : '0'; }).join(''));
      return Promise.all(flashes);
    }

    digits(bits, { instant: true });
    return {
      el: el,
      hands: hands,
      strip: strip,
      cells: cells,
      show: function (n, ctx) { return A.parallel(hands.setBits(n, ctx), digits(n, ctx)); },
      digits: digits,
      // Make one finger's value badge appear (badges start hidden when opts.labels === 'hidden').
      badge: function (i, ctx) {
        var b = hands.fingerAt(i).badge;
        b.style.display = '';
        return A.pop(b.firstChild, ctx);
      },
      hideBadges: function () { U.range(FINGERS).forEach(function (i) { hands.fingerAt(i).badge.style.display = 'none'; }); }
    };
  }

  // Display index of the finger worth `value` (right pinky = 1 is index 9).
  function indexOfValue(value) { return FINGERS - 1 - Math.round(Math.log(value) / Math.LN2); }

  // A text chip flies from `from` (any element, SVG too) to `to`, both inside `layer` (position: relative).
  function flyText(text, from, to, layer, ctx, cls) {
    if (ctx.instant || ctx.reducedMotion) return Promise.resolve();
    var l = layer.getBoundingClientRect(), f = from.getBoundingClientRect(), t = to.getBoundingClientRect();
    var chip = U.el('span', { class: ['bin-fly', cls], text: text, 'aria-hidden': 'true' });
    chip.style.left = (f.left - l.left + f.width / 2) + 'px';
    chip.style.top = (f.top - l.top + f.height / 2) + 'px';
    layer.appendChild(chip);
    var dx = (t.left + t.width / 2) - (f.left + f.width / 2);
    var dy = (t.top + t.height / 2) - (f.top + f.height / 2);
    function done() { if (chip.parentNode) chip.parentNode.removeChild(chip); }
    return A.run(chip, [
      { transform: 'translate(-50%, -50%) translate(0px, 0px) scale(1)' },
      { transform: 'translate(-50%, -50%) translate(' + dx / 2 + 'px, ' + (dy > 0 ? dy * 0.35 : dy / 2 - 50) + 'px) scale(1.3)', offset: 0.5 },
      { transform: 'translate(-50%, -50%) translate(' + dx + 'px, ' + dy + 'px) scale(1)' }
    ], { duration: 650, easing: 'ease-in-out' }, ctx, 'transient').then(done, function (e) { done(); throw e; });
  }

  // Stars that shoot out of `layer` and fade (transient: nothing is left behind).
  function burst(layer, ctx, count) {
    if (ctx.instant) return Promise.resolve();
    var n = ctx.reducedMotion ? 1 : (count || 10);
    var box = U.el('div', { class: 'bin-burst', 'aria-hidden': 'true' });
    U.range(n).forEach(function (i) {
      var star = NS.icons.render('star', { class: 'bin-burst-star' });
      star.style.setProperty('--a', (i * 360 / n) + 'deg');
      star.style.setProperty('--d', (i % 2 ? 7 : 11) + 'rem');
      box.appendChild(star);
    });
    layer.appendChild(box);
    function done() { if (box.parentNode) box.parentNode.removeChild(box); }
    return A.wait(1500, ctx).then(done, function (e) { done(); throw e; });
  }

  // A cartoon computer chip with blinking lights (original inline SVG).
  function chipArt() {
    var leds = [];
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        leds.push(U.svg('circle', { class: 'bin-led', cx: 32 + c * 12, cy: 32 + r * 12, r: 4.2,
          style: { animationDelay: ((r * 4 + c) * 0.37 % 1.6).toFixed(2) + 's' } }));
      }
    }
    var pins = [];
    for (var k = 0; k < 5; k++) {
      var p = 26 + k * 12;
      pins.push(U.svg('rect', { x: p - 3, y: 6, width: 6, height: 12, rx: 2 }));
      pins.push(U.svg('rect', { x: p - 3, y: 82, width: 6, height: 12, rx: 2 }));
      pins.push(U.svg('rect', { x: 6, y: p - 3, width: 12, height: 6, rx: 2 }));
      pins.push(U.svg('rect', { x: 82, y: p - 3, width: 12, height: 6, rx: 2 }));
    }
    return U.svg('svg', { class: 'bin-chip', viewBox: '0 0 100 100', role: 'img', 'aria-label': 'a computer chip with blinking lights' },
      U.svg('g', { class: 'bin-chip-pins' }, pins),
      U.svg('rect', { class: 'bin-chip-body', x: 16, y: 16, width: 68, height: 68, rx: 10 }),
      leds);
  }

  // ---------- 2.1 Fingers are switches ----------

  var switches = {
    id: 'switches',
    title: 'Fingers are switches',
    setup: function (stage) {
      var board = makeBoard({ bits: 0 });
      hidden(board.el);
      hidden(board.strip);
      var count = hidden(U.el('div', { class: 'bin-big bin-count', text: '0' }));
      var up = hidden(U.el('span', { class: 'bin-legend-item is-up' }, U.el('b', { text: 'up' }), ' = ', U.el('strong', { text: '1' })));
      var down = hidden(U.el('span', { class: 'bin-legend-item is-down' }, U.el('b', { text: 'down' }), ' = ', U.el('strong', { text: '0' })));
      var word = hidden(U.el('div', { class: 'bin-word', text: 'binary' }));
      var chip = hidden(U.el('div', { class: 'bin-chip-wrap' }, chipArt()));
      var root = U.el('div', { class: 'bin-scene bin-switches' },
        U.el('div', { class: 'bin-row' }, board.el, count),
        U.el('div', { class: 'bin-row bin-legend' }, up, down, word, chip));
      stage.appendChild(root);
      return { board: board, count: count, up: up, down: down, word: word, chip: chip };
    },
    steps: [
      {
        say: 'Usually we count one finger at a time. Ten fingers make ten numbers.',
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('whoosh');
          var chain = A.parallel(A.pop(s.board.el, ctx), A.pop(s.count, ctx));
          U.range(FINGERS).forEach(function (i) {
            chain = chain.then(function () {
              ctx.sound('pop');
              s.count.textContent = String(i + 1);
              return A.parallel(s.board.hands.setFingers(i + 1, ctx), ctx.wait(260));
            });
          });
          return chain.then(function () { return A.bounce(s.count, ctx); });
        }
      },
      {
        say: 'But what if every finger was a switch? Up means one. Down means zero.',
        do: function (ctx) {
          var s = ctx.state;
          return ctx.cue(0).then(function () {
            return A.parallel(A.fadeOut(s.count, ctx), s.board.show(0, ctx), A.fadeIn(s.board.strip, ctx));
          }).then(function () {
            s.count.hidden = true;
            return ctx.cue(1);
          }).then(function () {
            ctx.sound('pop');
            return A.parallel(s.board.show(1, ctx), A.pop(s.up, ctx));
          }).then(function () { return ctx.cue(2); }).then(function () {
            ctx.sound('click');
            return A.parallel(s.board.show(0, ctx), A.pop(s.down, ctx));
          });
        }
      },
      {
        say: "With only two digits, zero and one, we're counting in binary. Computers count this way!",
        do: function (ctx) {
          var s = ctx.state;
          return A.parallel(A.highlight(s.up, ctx), A.highlight(s.down, ctx)).then(function () {
            ctx.sound('ding');
            return A.pop(s.word, ctx);
          }).then(function () { return ctx.cue(1); }).then(function () {
            ctx.sound('pop');
            s.chip.classList.add('is-on');
            return A.pop(s.chip, ctx);
          });
        }
      }
    ]
  };

  // ---------- 2.2 Each finger has a value ----------

  var values = {
    id: 'values',
    title: 'Each finger has a value',
    setup: function (stage) {
      var board = makeBoard({ bits: MAX, labels: true, strip: false });
      board.hideBadges();
      function row(name, nums, times, theme) {
        var cells = [];
        nums.forEach(function (n, i) {
          if (i) cells.push(U.el('span', { class: 'bin-times', text: '×' + times }));
          cells.push(U.el('span', { class: 'bin-place', text: String(n) }));
        });
        return hidden(U.el('div', { class: ['bin-compare-row', 'theme-' + theme] }, U.el('span', { class: 'bin-compare-name', text: name }), cells));
      }
      var ten = row('Base‑10', [1000, 100, 10, 1], 10, 'base10');
      var two = row('Binary', [8, 4, 2, 1], 2, 'binary');
      stage.appendChild(U.el('div', { class: 'bin-scene bin-values' }, board.el, U.el('div', { class: 'bin-compare' }, ten, two)));
      return { board: board, ten: ten, two: two };
    },
    steps: [
      {
        say: "Let's give each finger a number. This little finger on the right is worth one.",
        do: function (ctx) {
          var s = ctx.state;
          return ctx.cue(1).then(function () {
            ctx.sound('pop');
            return A.parallel(s.board.badge(9, ctx), s.board.hands.glow(ctx, [9]));
          });
        }
      },
      {
        say: 'The next finger is worth double. Two!',
        do: function (ctx) {
          var s = ctx.state;
          return A.parallel(s.board.hands.glow(ctx, [8]), ctx.cue(1).then(function () {
            ctx.sound('pop');
            return s.board.badge(8, ctx);
          }));
        }
      },
      {
        say: 'Then four. Eight. Sixteen. Each finger is worth double the one before, all the way up to five hundred twelve!',
        do: function (ctx) {
          var s = ctx.state;
          var chain = Promise.resolve();
          [7, 6, 5].forEach(function (i, k) {
            chain = chain.then(function () { return ctx.cue(k); }).then(function () {
              ctx.sound('pop');
              return s.board.badge(i, ctx);
            });
          });
          return chain.then(function () { return ctx.cue(3); }).then(function () {
            return A.stagger([4, 3, 2, 1, 0], function (i) {
              ctx.sound('pop');
              return s.board.badge(i, ctx);
            }, 450, ctx);
          }).then(function () {
            ctx.sound('ding');
            return s.board.hands.glow(ctx, [0]);
          });
        }
      },
      {
        say: 'In base ten, each place is worth ten times more. In binary, each place is worth just two times more!',
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('whoosh');
          return A.pop(s.ten, ctx).then(function () { return ctx.cue(1); }).then(function () {
            ctx.sound('whoosh');
            return A.pop(s.two, ctx);
          }).then(function () { return A.highlight(s.two, ctx); });
        }
      }
    ]
  };

  // ---------- 2.3 Let's count ----------

  // Time between numbers in the auto count: starts slow, speeds up.
  function tickMs(k) { return Math.max(250, 900 - k * 30); }
  var COUNT_TO = 31;

  function readouts() {
    var number = U.el('div', { class: 'bin-big bin-decimal', text: '0', 'aria-live': 'polite' });
    var sum = U.el('div', { class: 'bin-sum', text: '0' });
    var el = U.el('div', { class: 'bin-readouts' },
      U.el('div', { class: 'bin-readout' }, U.el('span', { class: 'bin-readout-name', text: 'Decimal' }), number),
      U.el('div', { class: 'bin-readout bin-readout-sum' }, U.el('span', { class: 'bin-readout-name', text: 'Fingers add up to' }), sum));
    return {
      el: el, number: number, sum: sum,
      set: function (n) { number.textContent = String(n); sum.textContent = breakdown(n); }
    };
  }

  var counting = {
    id: 'count',
    title: "Let's count!",
    setup: function (stage) {
      var board = makeBoard({ bits: 0, labels: true });
      var out = readouts();
      var root = hidden(U.el('div', { class: 'bin-scene bin-count' }, U.el('div', { class: 'bin-row' }, board.el, out.el)));
      stage.appendChild(root);
      return { board: board, out: out, root: root };
    },
    steps: [
      {
        say: 'Zero. All fingers down.',
        do: function (ctx) {
          ctx.sound('pop');
          return A.pop(ctx.state.root, ctx);
        }
      },
      {
        say: 'One. The little finger goes up.',
        do: function (ctx) {
          var s = ctx.state;
          return ctx.cue(1).then(function () {
            ctx.sound('pop');
            s.out.set(1);
            return A.parallel(s.board.show(1, ctx), A.pop(s.out.number, ctx));
          });
        }
      },
      {
        say: 'Two. Put that finger down, and the next one up. Just like carrying!',
        do: function (ctx) {
          var s = ctx.state;
          return ctx.cue(1).then(function () {
            ctx.sound('pop');
            s.out.set(2);
            return A.parallel(s.board.show(2, ctx), A.pop(s.out.number, ctx));
          }).then(function () { return ctx.cue(2); }).then(function () {
            ctx.sound('carry');
            return A.parallel(s.board.hands.glow(ctx, [8]), A.bounce(s.board.cells[8], ctx));
          });
        }
      },
      {
        say: 'Three. Both fingers up. Two plus one makes three.',
        do: function (ctx) {
          var s = ctx.state;
          return ctx.cue(1).then(function () {
            ctx.sound('pop');
            s.out.number.textContent = '3';
            s.out.sum.textContent = '3';
            return A.parallel(s.board.show(3, ctx), A.pop(s.out.number, ctx));
          }).then(function () { return ctx.cue(2); }).then(function () {
            ctx.sound('ding');
            s.out.set(3);
            return A.parallel(A.pop(s.out.sum, ctx), s.board.hands.glow(ctx, [8, 9]));
          });
        }
      },
      {
        say: 'Now watch it count all by itself!',
        do: function (ctx) {
          var s = ctx.state;
          if (ctx.instant) { s.out.set(COUNT_TO); return s.board.show(COUNT_TO, ctx); }
          var chain = ctx.wait(500);
          U.range(COUNT_TO - 3).forEach(function (k) {
            var n = 4 + k;
            chain = chain.then(function () {
              ctx.sound('click');
              s.out.set(n);
              return A.parallel(s.board.show(n, ctx), ctx.wait(tickMs(k)));
            });
          });
          return chain;
        }
      },
      {
        say: 'Thirty-one! One hand can count all the way to thirty-one, not just five.',
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('ding');
          return A.parallel(A.bounce(s.out.number, ctx), A.highlight(s.out.number, ctx)).then(function () {
            return ctx.cue(1);
          }).then(function () {
            return A.parallel(s.board.hands.glow(ctx, [5, 6, 7, 8, 9]), A.highlight(s.out.sum, ctx));
          });
        }
      }
    ]
  };

  // ---------- 2.4 How high can we go? ----------

  var ALL = bitValues(MAX); // [512, 256, ..., 1]

  var high = {
    id: 'high',
    title: 'How high can we go?',
    setup: function (stage) {
      var board = makeBoard({ bits: 0, labels: true, class: 'bin-board-sm' });
      var terms = ALL.map(function (v, i) {
        return hidden(U.el('span', { class: 'bin-term' }, i ? U.el('span', { class: 'bin-plus', text: '+' }) : null, U.el('span', { text: String(v) })));
      });
      var running = hidden(U.el('span', { class: 'bin-running', text: '= 0' }));
      var total = hidden(U.el('div', { class: 'bin-big bin-total', text: String(MAX) }));
      var doubles = U.range(FINGERS).map(function (i) {
        return hidden(U.el('span', { class: 'bin-two' }, i ? U.el('span', { class: 'bin-times', text: '×' }) : null, U.el('span', { text: '2' })));
      });
      var many = hidden(U.el('div', { class: 'bin-many' }, U.el('span', { text: '0, 1, 2, … ' + MAX }), U.el('span', { class: 'bin-arrow', text: '→' }),
        U.el('strong', { text: (MAX + 1) + ' numbers' })));
      var doublesEq = hidden(U.el('span', { class: 'bin-two-eq', text: '= ' + (MAX + 1) }));
      var root = U.el('div', { class: 'bin-scene bin-high' },
        board.el,
        U.el('div', { class: 'bin-sumrow' }, terms, running),
        U.el('div', { class: 'bin-row bin-high-end' }, total,
          U.el('div', { class: 'bin-high-more' }, many, U.el('div', { class: 'bin-doubles' }, doubles, doublesEq))));
      stage.appendChild(root);
      return { board: board, terms: terms, running: running, total: total, many: many, doubles: doubles, doublesEq: doublesEq, root: root };
    },
    steps: [
      {
        say: 'What if all ten fingers are up?',
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('whoosh');
          return s.board.show(MAX, ctx).then(function () {
            ctx.sound('ding');
            return s.board.hands.glow(ctx);
          });
        }
      },
      {
        say: "Let's add them up! " + ALL.map(function (v, i) {
          return (i === ALL.length - 1 ? 'And ' + words(v) : cap(words(v))) + '.';
        }).join(' '),
        do: function (ctx) {
          var s = ctx.state;
          var chain = Promise.resolve();
          var sum = 0;
          ALL.forEach(function (v, i) {
            chain = chain.then(function () { return ctx.cue(i + 1); }).then(function () {
              var f = s.board.hands.fingerAt(indexOfValue(v));
              ctx.sound('whoosh');
              return A.parallel(flyText(String(v), f.badge, s.terms[i], s.root, ctx), s.board.hands.glow(ctx, [indexOfValue(v)]),
                A.wait(650, ctx).then(function () {
                sum += v;
                s.running.textContent = '= ' + sum;
                ctx.sound('pop');
                return A.parallel(A.pop(s.terms[i], ctx), i === 0 ? A.pop(s.running, ctx) : A.highlight(s.running, ctx));
              }));
            });
          });
          return chain;
        }
      },
      {
        say: 'One thousand twenty-three! With ten fingers, you can count all the way to one thousand twenty-three, not just ten!',
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('tada');
          return A.parallel(A.pop(s.total, ctx, { duration: 700 }), burst(s.total, ctx, 12), s.board.hands.glow(ctx))
            .then(function () { return ctx.cue(1); })
            .then(function () { return A.parallel(A.bounce(s.total, ctx), A.highlight(s.total, ctx)); });
        }
      },
      {
        say: 'Counting zero too, that makes one thousand twenty-four different numbers. ' +
          'Each finger doubles how many numbers you can make. Two, times two, times two, ten times!',
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('pop');
          return A.pop(s.many, ctx).then(function () { return ctx.cue(2); }).then(function () {
            return A.stagger(s.doubles, function (d) {
              ctx.sound('click');
              return A.pop(d, ctx);
            }, 220, ctx);
          }).then(function () {
            ctx.sound('ding');
            return A.pop(s.doublesEq, ctx);
          });
        }
      }
    ]
  };

  // ---------- 2.5 Reading binary numbers ----------

  // One example: a row of binary digit tiles; reading it raises the matching fingers.
  function example(n) {
    var digits = NS.numeral.toDigits(n, 2);
    var tiles = digits.map(function (d) { return NS.digitTile.create({ set: 'binary', value: d, size: 'lg' }); });
    var row = hidden(U.el('div', { class: 'bin-tiles', role: 'img', 'aria-label': 'Binary ' + digits.join('') },
      tiles.map(function (t) { return t.el; })));
    return { n: n, digits: digits, tiles: tiles, row: row };
  }

  // Read the digits one per sentence (cue first+k): the tile bounces, a "1" raises its finger.
  function readDigits(ex, s, ctx, first) {
    var chain = Promise.resolve();
    var shown = 0;
    ex.digits.forEach(function (d, k) {
      var value = Math.pow(2, ex.digits.length - 1 - k);
      chain = chain.then(function () { return ctx.cue(first + k); }).then(function () {
        var t = ex.tiles[k];
        t.setLit(true);
        if (!d) { ctx.sound('click'); return t.wiggle(ctx); }
        shown += value;
        ctx.sound('pop');
        return A.parallel(t.bounce(ctx), s.board.show(shown, ctx));
      });
    });
    return chain;
  }

  // Build "8 + 0 + 2 + 1 = 11" one term per sentence, then show the answer.
  function addUp(terms, n, s, ctx, first) {
    var chain = Promise.resolve();
    var text = [];
    terms.forEach(function (v, k) {
      chain = chain.then(function () { return ctx.cue(first + k); }).then(function () {
        text.push(String(v));
        s.sum.textContent = text.join(' + ');
        ctx.sound(v ? 'pop' : 'click');
        var anim = [A.pop(s.sum, ctx, { duration: 300 })];
        if (v) anim.push(s.board.hands.glow(ctx, [indexOfValue(v)]));
        return A.parallel.apply(null, anim);
      });
    });
    return chain.then(function () { return ctx.cue(first + terms.length); }).then(function () {
      ctx.sound('ding');
      s.sum.textContent = text.join(' + ') + ' = ' + n;
      s.answer.textContent = String(n);
      return A.parallel(A.pop(s.answer, ctx), A.highlight(s.sum, ctx));
    });
  }

  var reading = {
    id: 'reading',
    title: 'Reading binary numbers',
    setup: function (stage) {
      var board = makeBoard({ bits: 0, labels: true, class: 'bin-board-sm' });
      var ex1 = example(EXAMPLES[0]);
      var ex2 = example(EXAMPLES[1]);
      ex2.row.hidden = true;
      var sum = U.el('div', { class: 'bin-sum bin-sum-read' });
      var answer = hidden(U.el('div', { class: 'bin-big bin-answer' }));
      var root = U.el('div', { class: 'bin-scene bin-reading' },
        ex1.row, ex2.row, board.el, U.el('div', { class: 'bin-row bin-read-sum' }, sum, answer));
      stage.appendChild(root);
      return { board: board, ex1: ex1, ex2: ex2, sum: sum, answer: answer };
    },
    steps: [
      {
        say: "Here's a binary number. " + D.speak(EXAMPLES[0], 'binary').split('-').map(function (w) { return cap(w) + '.'; }).join(' '),
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('whoosh');
          return A.pop(s.ex1.row, ctx).then(function () { return readDigits(s.ex1, s, ctx, 1); });
        }
      },
      {
        say: placeTerms(EXAMPLES[0]).map(function (v, k) { return (k ? 'Plus ' + words(v) : cap(words(v))) + '.'; }).join(' ') +
          ' That makes ' + words(EXAMPLES[0]) + '!',
        do: function (ctx) {
          return addUp(placeTerms(EXAMPLES[0]), EXAMPLES[0], ctx.state, ctx, 0);
        }
      },
      {
        say: "Here's another one. " + D.speak(EXAMPLES[1], 'binary').split('-').map(function (w) { return cap(w) + '.'; }).join(' '),
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('whoosh');
          return A.parallel(A.fadeOut(s.ex1.row, ctx), A.fadeOut(s.answer, ctx), A.fadeOut(s.sum, ctx), s.board.show(0, ctx)).then(function () {
            s.ex1.row.hidden = true;
            s.sum.textContent = '';
            s.sum.style.opacity = '';
            s.ex2.row.hidden = false;
            return A.pop(s.ex2.row, ctx);
          }).then(function () { return readDigits(s.ex2, s, ctx, 1); });
        }
      },
      {
        say: 'Fingers that are down count as zero, so we only add the fingers that are up. ' +
          bitValues(EXAMPLES[1]).map(function (v, k) { return (k ? 'Plus ' + words(v) : cap(words(v))) + '.'; }).join(' ') +
          ' That makes ' + words(EXAMPLES[1]) + '!',
        do: function (ctx) {
          var s = ctx.state;
          return s.board.hands.glow(ctx).then(function () {
            return addUp(bitValues(EXAMPLES[1]), EXAMPLES[1], s, ctx, 1);
          });
        }
      }
    ]
  };

  // ---------- 2.6 You try it! ----------

  var tryIt = {
    id: 'try',
    title: 'You try it!',
    interactive: true,
    setup: function (stage, setupCtx) {
      var ctrl = new AbortController();
      var signal = ctrl.signal;
      var reducedMotion = setupCtx.reducedMotion;
      var live = { speed: 1, reducedMotion: reducedMotion, signal: signal };
      var s = { ctrl: ctrl, bits: 0, age: null, index: 0, stars: 0, busy: false, hinting: false, sayTimer: null };

      // Speak a line (and show it as a caption) unless the step's own narration is still playing.
      function say(text) {
        if (signal.aborted) return;
        if (setupCtx.player && setupCtx.player.getMode() === 'playing') return;
        NS.narrator.speak('binary.try.live', text, { signal: signal }).catch(function () {});
      }
      function sayLater(text) {
        clearTimeout(s.sayTimer);
        s.sayTimer = setTimeout(function () { say(text); }, 450);
      }

      // Challenge card: stars, prompt, age box, "Show me" and "Skip".
      var prompt = U.el('p', { class: 'bin-prompt', 'aria-live': 'polite' });
      var starCount = U.el('span', { class: 'bin-star-count', text: '0' });
      var ageInput = U.el('input', { type: 'number', class: 'bin-age-input', min: '1', max: String(AGE_MAX), inputmode: 'numeric',
        'aria-label': 'Your age' });
      var ageForm = U.el('form', { class: 'bin-age', hidden: true, novalidate: '', onSubmit: function (e) { e.preventDefault(); setAge(ageInput.value); } },
        ageInput, U.el('button', { type: 'submit', class: 'btn btn-primary bin-age-ok' }, 'OK'));
      var hint = U.el('button', { type: 'button', class: 'btn bin-hint', onClick: function () { showMe(); } },
        NS.icons.render('play', { kind: 'ui' }), U.el('span', { text: 'Show me' }));
      var skip = U.el('button', { type: 'button', class: 'btn bin-skip', onClick: function () { advance(false); } }, 'Skip');
      var burstLayer = U.el('div', { class: 'bin-burst-anchor', 'aria-hidden': 'true' });
      var card = hidden(U.el('div', { class: 'bin-card' },
        U.el('span', { class: 'bin-stars', title: 'Stars' }, NS.icons.render('star', { kind: 'ui', class: 'bin-star-icon' }), starCount),
        prompt, ageForm, U.el('span', { class: 'bin-card-buttons' }, hint, skip), burstLayer));

      var board = makeBoard({ bits: 0, labels: true });
      var out = readouts();
      var offToggle = board.hands.onToggle(function (info) {
        if (s.hinting) return;
        update(info.bits);
        changed(cap(words(info.bits)) + '.');
      });

      function update(n) {
        s.bits = n;
        board.digits(n, live).catch(function () {});
        out.set(n);
        A.pop(out.number, live, { duration: 250 }).catch(function () {});
      }

      function current() { return CHALLENGES[s.index]; }
      function target() { return targetOf(current(), s); }
      function showChallenge() {
        prompt.textContent = challengeText(current(), s);
        var asking = target() === null;
        ageForm.hidden = !asking;
        hint.disabled = asking;
      }

      function setAge(raw) {
        var age = parseInt(raw, 10);
        if (!ageTarget(age)) {
          say('Type a number from one to ' + words(AGE_MAX) + '.');
          ageInput.focus();
          return;
        }
        s.age = age;
        showChallenge();
        A.pop(prompt, live).catch(function () {});
        if (isMet(current(), s)) celebrate();
        else say(challengeText(current(), s));
      }

      // Called after every finger tap.
      function changed(spoken) {
        if (s.busy) { sayLater(spoken); return; }
        if (isMet(current(), s)) celebrate();
        else sayLater(spoken);
      }

      function celebrate() {
        s.busy = true;
        clearTimeout(s.sayTimer);
        s.stars += 1;
        starCount.textContent = String(s.stars);
        NS.sound.play('tada');
        var t = target();
        var parts = bitValues(t).length;
        say(PRAISE[(s.stars - 1) % PRAISE.length] + ' ' + cap(parts > 1 && parts <= 4 ? sayBreakdown(t) : words(t)) + '!');
        card.classList.add('is-won');
        burst(burstLayer, live, 8).catch(function () {});
        U.sleep(2400, signal).then(function () { advance(true); }, function () {});
      }

      function advance(won) {
        s.busy = false;
        clearTimeout(s.sayTimer);
        card.classList.remove('is-won');
        s.index = nextChallenge(s.index, s);
        showChallenge();
        if (!won) NS.sound.play('click');
        A.pop(prompt, live).catch(function () {});
        say(challengeText(current(), s));
      }

      // "Show me": the fingers make the answer, then go back down so the child can try.
      function showMe() {
        var t = target();
        if (t === null || s.hinting || s.busy) return;
        s.hinting = true;
        hint.disabled = true;
        clearTimeout(s.sayTimer);
        say('Like this! ' + cap(sayBreakdown(t)) + '.');
        board.show(t, live).then(function () {
          out.set(t);
          return board.hands.glow(live);
        }).then(function () {
          return U.sleep(1800, signal);
        }).then(function () {
          return board.show(0, live);
        }).then(function () {
          out.set(0);
          s.bits = 0;
          s.hinting = false;
          hint.disabled = false;
          say('Now you try!');
        }, function () {});
      }

      showChallenge();
      var root = U.el('div', { class: 'bin-scene bin-try' }, card, U.el('div', { class: 'bin-row' }, board.el, out.el));
      stage.appendChild(root);
      s.card = card;
      s.prompt = prompt;
      s.board = board;
      s.out = out;
      s.offToggle = offToggle;
      s.setAge = setAge;
      return s;
    },
    teardown: function (stage, ctx) {
      var s = ctx.state;
      clearTimeout(s.sayTimer);
      if (s.ctrl) s.ctrl.abort();
      if (s.offToggle) s.offToggle();
    },
    steps: [
      {
        say: 'Your turn! Tap the fingers to put them up or down. The numbers below add up what you made. ' +
          'If you get stuck, press Show me. ' + challengeText(CHALLENGES[0], {}),
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('pop');
          return A.pop(s.card, ctx).then(function () { return ctx.cue(4); }).then(function () {
            return A.parallel(A.highlight(s.card, ctx), A.bounce(s.prompt, ctx));
          });
        }
      }
    ]
  };

  // ---------- 2.7 Did you know? ----------

  var know = {
    id: 'know',
    title: 'Did you know?',
    setup: function (stage) {
      var card = hidden(U.el('div', { class: 'bin-know' },
        U.el('div', { class: 'bin-chip-wrap' }, chipArt()),
        U.el('div', { class: 'bin-know-text' },
          U.el('h3', { class: 'bin-know-title', text: 'Did you know?' }),
          U.el('p', { text: 'A computer chip has billions of tiny switches. Each one is on or off, 1 or 0, just like your fingers!' }))));
      var lights = U.el('div', { class: 'bin-switch-row', 'aria-hidden': 'true' },
        [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0].map(function (b) {
          return hidden(U.el('span', { class: ['bin-switch', b ? 'is-one' : ''], text: String(b) }));
        }));
      var root = U.el('div', { class: 'bin-scene bin-know-scene' }, card, lights);
      stage.appendChild(root);
      return { card: card, lights: Array.prototype.slice.call(lights.children) };
    },
    steps: [
      {
        say: 'Did you know? A computer chip has billions of tiny switches. Each switch is on or off, one or zero, just like your fingers!',
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('pop');
          return A.pop(s.card, ctx).then(function () { return ctx.cue(1); }).then(function () {
            s.card.classList.add('is-on');
            return ctx.cue(2);
          }).then(function () {
            return A.stagger(s.lights, function (l) {
              ctx.sound('click');
              return A.pop(l, ctx);
            }, 120, ctx);
          });
        }
      },
      {
        say: 'Now you can count like a computer. With ten fingers, all the way to one thousand twenty-three!',
        do: function (ctx) {
          ctx.sound('tada');
          return A.parallel(A.highlight(ctx.state.card, ctx), burst(ctx.state.card, ctx, 10));
        }
      }
    ]
  };

  NS.lessons.register({
    id: 'binary',
    order: 20,
    title: 'Binary: Count to 1023 on Two Hands',
    shortTitle: 'Binary',
    spokenTitle: 'Binary: counting on two hands', // Movie mode chapter card (js/movie.js)
    blurb: 'Every finger is a switch. Ten fingers can count way past ten!',
    ageHint: '7+',
    theme: 'binary',
    icon: 'hands',
    glyph: '101',
    scenes: [switches, values, counting, high, reading, tryIt, know],
    // Pure helpers, exposed for unit tests.
    helpers: {
      MAX: MAX, CHALLENGES: CHALLENGES, EXAMPLES: EXAMPLES, AGE_MAX: AGE_MAX, COUNT_TO: COUNT_TO,
      bitValues: bitValues, placeTerms: placeTerms, breakdown: breakdown, sayBreakdown: sayBreakdown,
      leadingZeros: leadingZeros, ageTarget: ageTarget, targetOf: targetOf, challengeText: challengeText,
      isMet: isMet, nextChallenge: nextChallenge, tickMs: tickMs
    }
  });
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
