// Lesson 1: Base-10, counting on our fingers (docs/plan/CONTENT.md § Lesson 1).
// Ten fingers -> ten digits -> bundling tens -> place value (237 = 200 + 30 + 7) -> x10 per place,
// then an interactive "You try it!" with clickable hands, a +/- place-value board and challenges.
//
// Lesson files must not touch the DOM at load time: everything happens inside setup/do.
// Steps that follow the narration word by word use ctx.cue(i) (sentence i of `say` has started).
// Math narration comes from NS.digitsets.speak so the words and the numbers can't disagree (D12).
(function (NS) {
  'use strict';

  var U = NS.util;
  var A = NS.anim;
  var D = NS.digitsets;

  function words(n) { return D.speak(n, 'decimal'); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  // "One. Two. Three." (each number is its own sentence, so each one gets its own cue)
  function countSentences(from, to, last) {
    var out = [];
    for (var n = from; n <= to; n++) out.push(cap(words(n)) + (n === to && last ? last : '.'));
    return out.join(' ');
  }

  // ---------- "You try it!" challenges (pure, unit-tested) ----------

  var CHALLENGES = [
    { kind: 'fingers', target: 7 },
    { kind: 'board', target: 42 },
    { kind: 'fingers', target: 10 },
    { kind: 'board', target: 305 },
    { kind: 'fingers', target: 3 },
    { kind: 'board', target: 99 },
    { kind: 'fingers', target: 0 },
    { kind: 'board', target: 100 }
  ];

  function challengeText(ch) {
    if (ch.kind === 'fingers') {
      return ch.target === 0 ? 'Show me zero fingers! Make two fists.'
        : 'Show me ' + words(ch.target) + ' finger' + (ch.target === 1 ? '' : 's') + '!';
    }
    return 'Make the number ' + words(ch.target) + '!';
  }

  // state: {fingers: how many fingers are up, board: the board's number}
  function isMet(ch, state) {
    return ch.kind === 'fingers' ? state.fingers === ch.target : state.board === ch.target;
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

  var PRAISE = ['Yes!', 'You got it!', 'Great job!', 'Super!', 'Wow, well done!'];

  // ---------- small scene helpers ----------

  function hidden(el) { el.style.opacity = '0'; return el; }

  function bigNumber(text, cls) {
    return hidden(U.el('div', { class: ['b10-big', cls], text: text, 'aria-live': 'polite' }));
  }

  function setBig(el, n, ctx) {
    el.textContent = String(n);
    return A.pop(el, ctx);
  }

  // A copy of `from` flies to `to` (both inside `layer`, which is position: relative), then vanishes.
  function fly(from, to, layer, ctx) {
    if (ctx.instant || ctx.reducedMotion) return Promise.resolve();
    var l = layer.getBoundingClientRect(), f = from.getBoundingClientRect(), t = to.getBoundingClientRect();
    var clone = from.cloneNode(true);
    clone.classList.add('b10-fly');
    clone.removeAttribute('id');
    clone.style.left = (f.left - l.left) + 'px';
    clone.style.top = (f.top - l.top) + 'px';
    clone.style.width = f.width + 'px';
    clone.style.height = f.height + 'px';
    clone.style.opacity = '1';
    layer.appendChild(clone);
    var dx = (t.left + t.width / 2) - (f.left + f.width / 2);
    var dy = (t.top + t.height / 2) - (f.top + f.height / 2);
    var scale = Math.max(0.3, Math.min(1.5, t.height / Math.max(1, f.height)));
    function done() { if (clone.parentNode) clone.parentNode.removeChild(clone); }
    return A.run(clone, [
      { transform: 'translate(0px, 0px) scale(1)' },
      { transform: 'translate(' + dx / 2 + 'px, ' + (Math.min(dy, 0) / 2 - 40) + 'px) scale(1.1)', offset: 0.5 },
      { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + scale + ')' }
    ], { duration: 700, easing: 'ease-in-out' }, ctx, 'transient').then(done, function (e) { done(); throw e; });
  }

  function unitsOf(pv, power) { return pv.column(power).querySelector('.pv-units'); }

  // ---------- scenes ----------

  var hello = {
    id: 'hello',
    title: 'Hello, fingers!',
    setup: function (stage) {
      var hands = NS.hands.create({ hands: 'both', fingers: 10 });
      hidden(hands.el);
      var number = bigNumber('0');
      var group = hidden(U.el('div', { class: 'b10-group' }, U.el('span', { text: 'a group of ' }), U.el('strong', { text: 'ten' })));
      stage.appendChild(U.el('div', { class: 'b10-scene b10-hello' },
        U.el('div', { class: 'b10-hands-wrap' }, hands.el, group), number));
      return { hands: hands, number: number, group: group };
    },
    steps: [
      {
        say: "Hi! Let's count. Hold up your hands. How many fingers do you have?",
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('whoosh');
          return A.pop(s.hands.el, ctx).then(function () { return ctx.cue(2); }).then(function () { return s.hands.wave(ctx); });
        }
      },
      {
        say: "Let's count them together. " + countSentences(1, 10, '!'),
        do: function (ctx) {
          var s = ctx.state;
          // Make two fists while we say "let's count", then one finger per number.
          var chain = s.hands.setFingers(0, ctx);
          U.range(10).forEach(function (i) {
            var k = i + 1;
            chain = chain.then(function () { return ctx.cue(k); }).then(function () {
              ctx.sound('pop');
              return A.parallel(s.hands.setFingers(k, ctx), setBig(s.number, k, ctx));
            });
          });
          return chain;
        }
      },
      {
        say: "Ten fingers! That's why people count in groups of ten.",
        do: function (ctx) {
          var s = ctx.state;
          ctx.sound('ding');
          return A.parallel(s.hands.glow(ctx), A.bounce(s.number, ctx), A.highlight(s.number, ctx))
            .then(function () { return ctx.cue(1); })
            .then(function () { return A.pop(s.group, ctx); });
        }
      }
    ]
  };

  var digits = {
    id: 'digits',
    title: 'Ten digits',
    setup: function (stage) {
      var tiles = U.range(10).map(function (v) {
        return NS.digitTile.create({ set: 'decimal', value: v, size: 'md', hidden: true });
      });
      var question = hidden(U.el('span', { class: 'b10-question', role: 'img', 'aria-label': 'question mark', text: '?' }));
      var label = hidden(U.el('div', { class: 'b10-word', text: 'digits' }));
      var hand = NS.hands.create({ hands: 'right', fingers: 0 });
      hand.setFinger('right', 'index', true, { instant: true });
      var finger = hidden(U.el('div', { class: 'b10-finger' }, hand.el));
      var bubble = hidden(U.el('div', { class: 'b10-bubble' },
        U.el('strong', { text: 'digit' }), U.el('span', { text: ' = ' }), U.el('strong', { text: 'finger' })));
      var root = U.el('div', { class: 'b10-scene b10-digits' },
        U.el('div', { class: 'b10-digits-top' }, finger, bubble),
        U.el('div', { class: 'b10-tiles' }, tiles.map(function (t) { return t.el; }), question),
        label);
      stage.appendChild(root);
      return { tiles: tiles, question: question, label: label, finger: finger, hand: hand, bubble: bubble, root: root };
    },
    steps: [
      {
        say: 'We write every number with just ten little symbols. They are called digits.',
        do: function (ctx) {
          var s = ctx.state;
          return A.stagger(s.tiles, function (t) {
            ctx.sound('click');
            return A.run(t.el, [{ opacity: 0, transform: 'translateY(60px) scale(.6)' }, { opacity: 1, transform: 'translateY(0px) scale(1)' }],
              { duration: 450 }, ctx);
          }, 110, ctx).then(function () { return ctx.cue(1); }).then(function () { return A.pop(s.label, ctx); });
        }
      },
      {
        say: countSentences(0, 9),
        do: function (ctx) {
          var s = ctx.state;
          var chain = Promise.resolve();
          s.tiles.forEach(function (t, i) {
            chain = chain.then(function () { return ctx.cue(i); }).then(function () {
              ctx.sound('pop');
              t.setLit(true);
              t.wiggle(ctx).catch(function () {});
            });
          });
          return chain.then(function () { return ctx.wait(400); });
        }
      },
      {
        say: 'Here is a fun fact. "Digit" is also a word for finger!',
        do: function (ctx) {
          var s = ctx.state;
          var one = s.tiles[1];
          return ctx.cue(1).then(function () {
            ctx.sound('pop');
            return A.pop(s.finger, ctx);
          }).then(function () {
            return s.hand.glow(ctx);
          }).then(function () {
            ctx.sound('whoosh');
            return A.parallel(fly(s.finger, one.el, s.root, ctx), A.fadeOut(s.finger, ctx, { duration: 700 }));
          }).then(function () {
            s.finger.hidden = true;
            ctx.sound('ding');
            return A.parallel(one.bounce(ctx), one.glow(ctx), A.pop(s.bubble, ctx));
          });
        }
      },
      {
        say: "But wait! There's no single digit for ten. What do we do?",
        do: function (ctx) {
          var s = ctx.state;
          return ctx.cue(1).then(function () {
            ctx.sound('click');
            return A.pop(s.question, ctx);
          }).then(function () { return ctx.cue(2); }).then(function () {
            return A.bounce(s.question, ctx);
          });
        }
      }
    ]
  };

  var bundle = {
    id: 'bundle',
    title: 'Making a bundle',
    setup: function (stage) {
      var pv = NS.placeValue.create({ set: 'decimal', value: 0, places: 3, arrows: false, units: true, tileSize: 'lg', class: 'b10-board' });
      [0, 1, 2].forEach(function (p) { hidden(pv.tile(p).el); });
      pv.column(2).style.visibility = 'hidden';
      stage.appendChild(U.el('div', { class: 'b10-scene b10-bundle' }, pv.el));
      return { pv: pv };
    },
    steps: [
      {
        say: 'Ten sticks are like ten fingers. When we run out of fingers, we tie the ten sticks into one bundle!',
        do: function (ctx) {
          var pv = ctx.state.pv;
          ctx.sound('pop');
          return pv.setUnits(0, 10, ctx).then(function () { return ctx.cue(1); }).then(function () {
            ctx.sound('whoosh');
            return pv.regroup(0, ctx);
          }).then(function () { ctx.sound('ding'); });
        }
      },
      {
        say: 'We write one bundle in the tens place. And zero leftover sticks in the ones place. That makes ten!',
        do: function (ctx) {
          var pv = ctx.state.pv;
          return ctx.cue(0).then(function () {
            ctx.sound('pop');
            return A.parallel(pv.tile(1).pop(ctx), pv.highlightPlace(1, ctx));
          }).then(function () { return ctx.cue(1); }).then(function () {
            ctx.sound('pop');
            return A.parallel(pv.tile(0).pop(ctx), pv.highlightPlace(0, ctx));
          });
        }
      },
      {
        say: "Let's keep counting. " + countSentences(11, 15),
        do: function (ctx) {
          var pv = ctx.state.pv;
          var chain = Promise.resolve();
          U.range(5).forEach(function (i) {
            chain = chain.then(function () { return ctx.cue(i + 1); }).then(function () {
              ctx.sound('pop');
              var flip = pv.set(11 + i, ctx);
              return A.parallel(flip, A.pop(unitsOf(pv, 0).lastChild, ctx));
            });
          });
          return chain;
        }
      },
      {
        say: 'Ten bundles make a hundred! A hundred is a bundle of bundles.',
        do: function (ctx) {
          var pv = ctx.state.pv;
          // Put the loose sticks away so we can watch the bundles.
          var sticks = Array.prototype.slice.call(unitsOf(pv, 0).children);
          return A.parallel.apply(null, sticks.map(function (u) { return A.fadeOut(u, ctx); }))
            .then(function () { return pv.set(10, ctx); })
            .then(function () {
              ctx.sound('pop');
              return A.parallel(A.fadeIn(pv.column(2), ctx), pv.setUnits(1, 10, ctx));
            })
            .then(function () { return ctx.cue(1); })
            .then(function () {
              ctx.sound('whoosh');
              return pv.regroup(1, ctx);
            })
            .then(function () {
              ctx.sound('ding');
              return A.parallel(pv.tile(2).pop(ctx), pv.highlightPlace(2, ctx));
            });
        }
      }
    ]
  };

  var NUMBER = 237;
  var PARTS = [200, 30, 7];
  var ZERO_NUMBER = 305; // a zero holds the tens place

  var meaning = {
    id: 'meaning',
    title: 'What does ' + NUMBER + ' mean?',
    setup: function (stage) {
      var big = hidden(U.el('div', { class: 'b10-big b10-big-number', role: 'img', 'aria-label': String(NUMBER) },
        String(NUMBER).split('').map(function (d) { return U.el('span', { class: 'b10-big-digit', text: d }); })));
      var pv = NS.placeValue.create({ set: 'decimal', value: NUMBER, places: 3, arrows: true, class: 'b10-board' });
      [0, 1, 2].forEach(function (p) { hidden(pv.tile(p).el); });
      var arrows = Array.prototype.slice.call(pv.el.querySelectorAll('.pv-arrow'));
      arrows.forEach(hidden);
      var root = U.el('div', { class: 'b10-scene b10-meaning' }, big, pv.el);
      stage.appendChild(root);
      return { big: big, digits: Array.prototype.slice.call(big.children), pv: pv, arrows: arrows, root: root };
    },
    steps: [
      {
        say: 'Look at this number: ' + words(NUMBER) + '.',
        do: function (ctx) {
          ctx.sound('pop');
          return A.pop(ctx.state.big, ctx);
        }
      },
      {
        say: 'It has two hundreds. Three tens. And seven ones.',
        do: function (ctx) {
          var s = ctx.state;
          var chain = Promise.resolve();
          s.digits.forEach(function (d, i) {
            var power = 2 - i;
            chain = chain.then(function () { return ctx.cue(i); }).then(function () {
              ctx.sound('whoosh');
              d.classList.add('is-sent');
              return fly(d, s.pv.tile(power).el, s.root, ctx);
            }).then(function () {
              ctx.sound('pop');
              return A.parallel(s.pv.tile(power).pop(ctx), s.pv.highlightPlace(power, ctx));
            });
          });
          return chain;
        }
      },
      {
        say: cap(PARTS.map(words).join(', plus ')) + ', makes ' + words(NUMBER) + '.',
        do: function (ctx) {
          ctx.sound('ding');
          return ctx.state.pv.expand(ctx);
        }
      },
      {
        say: 'What if a place is empty? Look at ' + words(ZERO_NUMBER) + '. It has no tens, so we write a zero in the tens place. ' +
          'The zero keeps every digit in its own place!',
        do: function (ctx) {
          var s = ctx.state;
          return ctx.cue(1).then(function () {
            ctx.sound('whoosh');
            String(ZERO_NUMBER).split('').forEach(function (d, i) { s.digits[i].textContent = d; });
            return A.parallel(A.pop(s.big, ctx), s.pv.set(ZERO_NUMBER, ctx));
          }).then(function () { return ctx.cue(2); }).then(function () {
            ctx.sound('pop');
            s.digits[1].classList.add('is-zero');
            return A.parallel(s.pv.tile(1).wiggle(ctx), s.pv.highlightPlace(1, ctx), A.bounce(s.digits[1], ctx));
          });
        }
      },
      {
        say: 'Each place is worth ten times the place to its right.',
        do: function (ctx) {
          var s = ctx.state;
          return A.stagger(s.arrows.slice().reverse(), function (a) {
            ctx.sound('pop');
            return A.pop(a, ctx);
          }, 500, ctx);
        }
      },
      {
        say: 'Ten ones make a ten. Ten tens make a hundred.',
        do: function (ctx) {
          var s = ctx.state;
          var right = s.arrows[s.arrows.length - 1], left = s.arrows[0];
          return ctx.cue(0).then(function () {
            return A.parallel(A.bounce(right, ctx), A.highlight(right, ctx), s.pv.highlightPlace(1, ctx));
          }).then(function () { return ctx.cue(1); }).then(function () {
            return A.parallel(A.bounce(left, ctx), A.highlight(left, ctx), s.pv.highlightPlace(2, ctx));
          });
        }
      }
    ]
  };

  // ---------- "You try it!" ----------

  var tryIt = {
    id: 'try',
    title: 'You try it!',
    interactive: true,
    setup: function (stage, setupCtx) {
      var ctrl = new AbortController();
      var signal = ctrl.signal;
      var reducedMotion = setupCtx.reducedMotion;
      var live = { speed: 1, reducedMotion: reducedMotion, signal: signal };
      var s = { ctrl: ctrl, fingers: 0, board: 0, index: 0, stars: 0, busy: false, sayTimer: null };

      // Speak a line (and show it as a caption) unless the step's own narration is still playing.
      function say(text) {
        if (signal.aborted) return;
        if (setupCtx.player && setupCtx.player.getMode() === 'playing') return;
        NS.narrator.speak('base10.try.live', text, { signal: signal }).catch(function () {});
      }
      function sayLater(text) {
        clearTimeout(s.sayTimer);
        s.sayTimer = setTimeout(function () { say(text); }, 450);
      }

      // Challenge card
      var prompt = U.el('p', { class: 'b10-prompt', 'aria-live': 'polite' });
      var starCount = U.el('span', { class: 'b10-star-count', text: '0' });
      var burst = U.el('div', { class: 'b10-burst', 'aria-hidden': 'true' });
      var skip = U.el('button', { type: 'button', class: 'btn b10-skip', onClick: function () { advance(false); } }, 'Skip');
      var card = hidden(U.el('div', { class: 'b10-card' },
        U.el('span', { class: 'b10-stars', title: 'Stars' }, NS.icons.render('star', { kind: 'ui', class: 'b10-star-icon' }), starCount),
        prompt, skip, burst));

      // Panel 1: clickable hands + big number
      var hands = NS.hands.create({ hands: 'both', fingers: 0 });
      var fingerNumber = U.el('div', { class: 'b10-big b10-try-number', text: '0', 'aria-live': 'polite' });
      var handsPanel = U.el('div', { class: 'b10-panel b10-panel-fingers' },
        U.el('div', { class: 'b10-hands-wrap' }, hands.el), fingerNumber);
      var offToggle = hands.onToggle(function (info) {
        s.fingers = info.count;
        fingerNumber.textContent = String(info.count);
        A.bounce(fingerNumber, live).catch(function () {});
        changed(words(info.count) + (info.count === 1 ? ' finger.' : ' fingers.'));
      });

      // Panel 2: 3-place board with +/- under every digit
      var pv = NS.placeValue.create({ set: 'decimal', value: 0, places: 3, arrows: true, units: true, class: 'b10-board b10-try-board' });
      var boardNumber = U.el('div', { class: 'b10-big b10-try-number', text: '0', 'aria-live': 'polite' });
      var buttons = [];
      [2, 1, 0].forEach(function (p) {
        var name = D.placeName(p, 10).toLowerCase();
        function btn(dir) {
          return U.el('button', {
            type: 'button', class: 'btn b10-step b10-step-' + (dir > 0 ? 'plus' : 'minus'),
            'aria-label': (dir > 0 ? 'One more in the ' : 'One less in the ') + name,
            onClick: function () { bump(p, dir); }
          }, NS.icons.render(dir > 0 ? 'plus' : 'minus', { kind: 'ui' }));
        }
        var minus = btn(-1), plus = btn(1);
        buttons[p] = { minus: minus, plus: plus };
        var col = pv.column(p);
        col.insertBefore(U.el('div', { class: 'b10-steppers' }, minus, plus), col.querySelector('.pv-contrib'));
      });
      function digitAt(p) { return Math.floor(s.board / Math.pow(10, p)) % 10; }
      function syncButtons() {
        [0, 1, 2].forEach(function (p) {
          buttons[p].minus.disabled = digitAt(p) === 0;
          buttons[p].plus.disabled = digitAt(p) === 9;
        });
      }
      function bump(p, dir) {
        var d = digitAt(p) + dir;
        if (d < 0 || d > 9) return;
        s.board += dir * Math.pow(10, p);
        NS.sound.play(dir > 0 ? 'pop' : 'click');
        pv.set(s.board, live).catch(function () {});
        boardNumber.textContent = String(s.board);
        syncButtons();
        changed(cap(words(s.board)) + '.');
      }
      syncButtons();
      var boardPanel = U.el('div', { class: 'b10-panel b10-panel-board', hidden: true }, boardNumber, pv.el);

      // Tabs to switch between the two toys (a challenge switches automatically).
      var tabs = {};
      function tab(kind, label, icon) {
        tabs[kind] = U.el('button', { type: 'button', class: 'btn b10-tab', 'aria-pressed': 'false', onClick: function () { show(kind); } },
          NS.icons.render(icon, { kind: 'ui' }), U.el('span', { text: label }));
        return tabs[kind];
      }
      function show(kind) {
        handsPanel.hidden = kind !== 'fingers';
        boardPanel.hidden = kind !== 'board';
        Object.keys(tabs).forEach(function (k) { tabs[k].setAttribute('aria-pressed', String(k === kind)); });
      }

      function current() { return CHALLENGES[s.index]; }
      function showChallenge() {
        var ch = current();
        prompt.textContent = challengeText(ch);
        show(ch.kind);
      }

      // Called after every change the child makes.
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
        say(PRAISE[(s.stars - 1) % PRAISE.length] + ' ' + cap(words(current().target)) + '!');
        card.classList.add('is-won');
        U.clear(burst);
        U.range(reducedMotion ? 1 : 8).forEach(function (i) {
          var star = NS.icons.render('star', { class: 'b10-burst-star' });
          star.style.setProperty('--a', (i * 45) + 'deg');
          burst.appendChild(star);
        });
        U.sleep(2200, signal).then(function () { advance(true); }, function () {});
      }

      function advance(won) {
        s.busy = false;
        clearTimeout(s.sayTimer);
        card.classList.remove('is-won');
        U.clear(burst);
        s.index = nextChallenge(s.index, s);
        showChallenge();
        if (!won) NS.sound.play('click');
        A.pop(prompt, live).catch(function () {});
        say(challengeText(current()));
      }

      showChallenge();
      var root = U.el('div', { class: 'b10-scene b10-try' },
        card,
        U.el('div', { class: 'b10-tabs', role: 'group', 'aria-label': 'Choose a toy' },
          tab('fingers', 'Fingers', 'hands'), tab('board', 'Big numbers', 'star')),
        handsPanel, boardPanel);
      stage.appendChild(root);
      show(current().kind);
      s.card = card;
      s.offToggle = offToggle;
      s.hands = hands;
      s.pv = pv;
      s.prompt = prompt;
      s.show = show;
      s.bump = bump;
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
        say: 'Your turn! Tap the fingers to put them up or down. Then try the big number board with the plus and minus buttons. ' +
          "Here's your first challenge. " + challengeText(CHALLENGES[0]),
        do: function (ctx) {
          ctx.sound('pop');
          return A.pop(ctx.state.card, ctx).then(function () { return ctx.cue(4); }).then(function () {
            return A.parallel(A.highlight(ctx.state.card, ctx), A.bounce(ctx.state.prompt, ctx));
          });
        }
      }
    ]
  };

  NS.lessons.register({
    id: 'base10',
    order: 10,
    title: 'Base‑10: Counting on Our Fingers',
    shortTitle: 'Base‑10',
    spokenTitle: 'Counting in tens, on our fingers', // Movie mode chapter card (js/movie.js)
    blurb: 'Ten fingers, ten digits, and the magic of bundling tens.',
    ageHint: '5+',
    theme: 'base10',
    icon: 'hands',
    glyph: 'icon:hands',
    scenes: [hello, digits, bundle, meaning, tryIt],
    // Pure helpers, exposed for unit tests.
    helpers: { CHALLENGES: CHALLENGES, challengeText: challengeText, isMet: isMet, nextChallenge: nextChallenge }
  });
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
