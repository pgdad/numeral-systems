// Lesson 5: Adding in Every System (docs/plan/CONTENT.md § Lesson 5).
// Column addition with carries in base ten, binary, hex, octal, animals and colors, then "You try it!":
// pick a system and a difficulty, and solve a random problem one column at a time.
//
// The math and the narration are generated, never typed: the columns come from NS.addition.addSteps and each
// column's sentence from NS.addition.explainStep, so what is said and what is shown can't disagree. Only the
// scene intros are hand-written. Each system's carry travels in its own way (column-add `hop`): base ten arcs,
// binary flips like a switch, octal wobbles, hex spins, the animal leaps, and the color bounces like a ball.
// Lesson files must not touch the DOM at load time: everything happens inside setup/do.
(function (NS) {
  'use strict';

  var U = NS.util;
  var A = NS.anim;
  var D = NS.digitsets;
  var ADD = NS.addition;

  function words(n) { return D.speak(n, 'decimal'); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function hidden(el) { el.style.opacity = '0'; return el; }
  function noop() {}

  // ---------- Pure helpers (unit-tested) ----------

  // The six systems, in picker order. `hop` is the carry's flavor, `names` shows digit names in the columns
  // (colors always do, DECISIONS D18), `inName` finishes "The answer is one-zero-zero-zero in binary".
  var SYSTEMS = [
    { set: 'decimal', name: 'Base‑10', hop: 'arc', inName: '' },
    { set: 'binary', name: 'Binary', hop: 'flip', inName: ' in binary' },
    { set: 'octal', name: 'Octal', hop: 'wobble', inName: ' in octal' },
    { set: 'hex', name: 'Hex', hop: 'spin', inName: ' in hex' },
    { set: 'animals', name: 'Animals', hop: 'leap', names: true, inName: '' },
    { set: 'colors', name: 'Colors', hop: 'bounce', names: true, inName: '' }
  ];
  function system(id) { return SYSTEMS.filter(function (x) { return x.set === id; })[0]; }

  // The worked examples (the same ones the Phase 01 addition tests check).
  var EXAMPLES = {
    decimal: { a: 47, b: 38 },
    binary: { a: 5, b: 3 },
    hex: { a: 0x2A, b: 0x1F },
    octal: { a: 15, b: 5 },      // octal 17 + 5
    animals: { a: 7, b: 13 },    // Dog-Frog + Frog-Pig
    colors: { a: 5, b: 8 }       // yellow-green + green-green
  };

  // How a number is read: words for base ten, digit names otherwise ("one-zero-one", "two A", "Dog-Frog").
  function read(n, set) { return D.speak(n, set); }

  // "Ones first!" / "Now the tens." / "Now the twenty-fives."
  function columnLead(step, set) {
    if (step.power === 0) return 'Ones first!';
    return 'Now the ' + D.placeName(step.power, D.resolve(set).base).toLowerCase() + '.';
  }

  // One column of narration: the lead, then explainStep's two sentences (the sum, then what to write and carry).
  function columnSay(step, set) { return columnLead(step, set) + ' ' + ADD.explainStep(step, set); }

  // The check in base ten, on screen: "7 + 13 = 20 ✓".
  function checkLine(a, b) { return a + ' + ' + b + ' = ' + (a + b) + ' ✓'; }

  // The last line of an example: the answer, then the check in base ten.
  function resultSay(set, a, b) {
    var sum = a + b;
    if (set === 'decimal') {
      return 'The answer is ' + words(sum) + '! ' + cap(words(a)) + ' plus ' + words(b) + ' makes ' + words(sum) + '.';
    }
    return 'The answer is ' + read(sum, set) + system(set).inName + "! Let's check in base ten. " +
      cap(words(a)) + ' plus ' + words(b) + ' is ' + words(sum) + '. Yes!';
  }

  // The four binary rules, each as its terms: 0+0, 0+1, 1+1, 1+1+1.
  var BINARY_RULES = [[0, 0], [0, 1], [1, 1], [1, 1, 1]];
  function sum(list) { return list.reduce(function (x, y) { return x + y; }, 0); }
  function ruleText(terms) { return terms.join(' + ') + ' = ' + NS.numeral.format(sum(terms), D.get('binary')); }
  function ruleSay(terms) {
    var total = sum(terms);
    return cap(terms.map(function (t) { return read(t, 'binary'); }).join(' plus ')) + ' is ' + read(total, 'binary') +
      (total > 1 ? ", that's " + words(total) : '') + '.';
  }

  // "You try it!" problems. o: {columns: 1-3, carries: true|false}; rand is injectable for tests.
  // The first number has exactly `columns` digits (with one column it may be zero), the second at most that many
  // and never zero. carries: true means at least one column carries; false means none does.
  var MAX_COLUMNS = 3;
  function hasCarry(a, b, base) { return ADD.addSteps(a, b, base).some(function (s) { return s.carryOut === 1; }); }
  function makeProblem(set, o, rand) {
    o = o || {};
    rand = rand || Math.random;
    var base = D.resolve(set).base;
    var cols = U.clamp(o.columns || 2, 1, MAX_COLUMNS);
    var carries = !!o.carries;
    var lo = cols === 1 ? 0 : Math.pow(base, cols - 1);
    var hi = Math.pow(base, cols) - 1;
    function pick(min, max) { return min + Math.floor(rand() * (max - min + 1)); }
    var a, b;
    for (var tries = 0; tries < 400; tries++) {
      if (carries) {
        a = pick(lo, hi);
        b = pick(1, hi);
      } else {
        // Column by column, so no column adds up to the base or more.
        a = 0; b = 0;
        for (var p = 0; p < cols; p++) {
          var x = pick(p === cols - 1 && cols > 1 ? 1 : 0, base - 1);
          var y = pick(0, base - 1 - x);
          a += x * Math.pow(base, p);
          b += y * Math.pow(base, p);
        }
      }
      if (b > 0 && hasCarry(a, b, base) === carries) break;
      a = null;
    }
    if (a === null) { a = carries ? hi : lo; b = 1; } // never needed in practice; keeps the promise
    return { set: set, a: a, b: b, columns: cols, carries: carries, steps: ADD.addSteps(a, b, base) };
  }

  // Check one column: pick = {digit, carry?}. carry is only checked when given.
  function checkColumn(step, pick) {
    return {
      digit: pick.digit === step.digit,
      carry: pick.carry === undefined ? null : pick.carry === step.carryOut
    };
  }

  // Check a whole written answer (digits most significant first, in the problem's base).
  function checkAnswer(problem, digits) {
    var base = D.resolve(problem.set).base;
    if (!Array.isArray(digits) || !digits.length) return false;
    if (digits.length > 1 && digits[0] === 0) return false;
    if (digits.some(function (d) { return !(d >= 0 && d < base && d === Math.floor(d)); })) return false;
    return NS.numeral.fromDigits(digits, base) === problem.a + problem.b;
  }

  // Gentle hints, straight from explainStep. A wrong digit first gets the sum, then the whole explanation.
  function hint(step, set, kind, tries) {
    var parts = NS.narrator.splitSentences(ADD.explainStep(step, set));
    if (kind === 'carry') {
      if (step.carryOut) return 'We need to carry! ' + parts.slice(1).join(' ');
      return 'No carry this time. ' + cap(words(step.total)) + ' is less than ' + words(D.resolve(set).base) + ', so nothing carries.';
    }
    if ((tries || 1) <= 1) return 'Not quite. ' + parts[0];
    return 'Here is how: ' + parts.join(' ');
  }

  // The question for one column: "Seven plus eight. Which digit do we write?"
  function columnQuestion(step, set) {
    var s = D.resolve(set);
    var values = step.carryIn ? [step.carryIn, step.da, step.db] : [step.da, step.db];
    return {
      text: values.map(function (v) { return s.digits[v].label; }).join(' + ') + '\u00a0=\u00a0?',
      say: cap(values.map(function (v) { return s.digits[v].speak; }).join(' plus ')) + '. Which digit do we write?'
    };
  }
  function carryQuestion(set) { return 'Do we carry ' + (D.resolve(set).kind === 'text' ? 'a one' : D.digitName(1, set)) + '?'; }

  var PRAISE = ['You did it!', 'Great adding!', 'Super!', 'Wow, well done!', 'You got it!'];

  // ---------- Small widgets ----------

  function sound(ctx, name) { if (ctx.sound) ctx.sound(name); }

  function makeAdder(set, a, b, cls) {
    var sys = system(set);
    return NS.columnAdd.create({ set: set, a: a, b: b, hop: sys.hop, names: !!sys.names, class: cls });
  }

  // "Check in base 10: 7 + 13 = 20 ✓"
  function checkBox(a, b, set) {
    return U.el('div', { class: 'ad-check' },
      set === 'decimal' ? null : U.el('span', { class: 'ad-check-label', text: 'Check in base 10:' }),
      U.el('span', { class: 'ad-check-sum', text: checkLine(a, b) }));
  }

  // Stars that shoot out of `layer` and fade (transient: nothing is left behind).
  function burst(layer, ctx, count) {
    if (ctx.instant) return Promise.resolve();
    var n = ctx.reducedMotion ? 1 : (count || 10);
    var box = U.el('div', { class: 'ad-burst', 'aria-hidden': 'true' });
    U.range(n).forEach(function (i) {
      var star = NS.icons.render('star', { class: 'ad-burst-star' });
      star.style.setProperty('--a', (i * 360 / n) + 'deg');
      box.appendChild(star);
    });
    layer.appendChild(box);
    function done() { if (box.parentNode) box.parentNode.removeChild(box); }
    return A.wait(1500, ctx).then(done, function (e) { done(); throw e; });
  }

  // Narrated column: light it on the lead, show the sum on sentence 1, write (and carry) on sentence 2.
  function columnStep(step, set) {
    return {
      say: columnSay(step, set),
      do: function (ctx) {
        var ca = ctx.state.ca;
        return ctx.cue(0).then(function () {
          ca.focusColumn(step.power);
          return ctx.cue(1);
        }).then(function () {
          return ca.showSum(step, ctx);
        }).then(function () { return ctx.cue(2); }).then(function () {
          return ca.writeDigit(step, ctx);
        }).then(function () { return ca.carry(step, ctx); });
      }
    };
  }

  // The answer: the sum bubble goes away, the answer row glows, and the base-ten check appears.
  function resultStep(set, a, b, extra) {
    return {
      say: resultSay(set, a, b),
      do: function (ctx) {
        var s = ctx.state;
        s.ca.hideSum();
        s.ca.focusColumn(null);
        s.ca.el.classList.add('is-solved');
        var first = A.stagger(s.ca.resultEl().slice().reverse(), function (c) { return A.bounce(c, ctx); }, 120, ctx);
        if (extra) first = A.parallel(first, extra(ctx));
        return first.then(function () { return ctx.cue(1); }).then(function () {
          sound(ctx, 'tada');
          return A.pop(s.check, ctx);
        });
      }
    };
  }

  // A worked-example scene. o: {id, title, set, intro, before: [steps before the intro], top(state) / side(state) -> extra
  // elements above / beside the columns, introDo(ctx), resultDo(ctx)}.
  function exampleScene(o) {
    var ex = EXAMPLES[o.set];
    var steps = ADD.addSteps(ex.a, ex.b, D.resolve(o.set).base);
    return {
      id: o.id,
      title: o.title,
      setup: function (stage) {
        var state = {};
        var ca = state.ca = makeAdder(o.set, ex.a, ex.b, 'ad-adder');
        hidden(ca.el);
        state.check = hidden(checkBox(ex.a, ex.b, o.set));
        var top = o.top ? o.top(state) : null;
        var side = o.side ? o.side(state) : null;
        stage.appendChild(U.el('div', { class: ['ad-scene', 'ad-example', 'ad-' + o.id] }, top,
          side ? U.el('div', { class: 'ad-row' }, ca.el, side) : ca.el, state.check));
        return state;
      },
      steps: (o.before || []).concat([{
        say: o.intro,
        do: function (ctx) {
          sound(ctx, 'whoosh');
          var chain = A.pop(ctx.state.ca.el, ctx);
          return o.introDo ? A.parallel(chain, o.introDo(ctx)) : chain;
        }
      }]).concat(steps.map(function (step) { return columnStep(step, o.set); }))
        .concat([resultStep(o.set, ex.a, ex.b, o.resultDo)])
    };
  }

  // ---------- 5.1 base ten ----------

  var decimal = exampleScene({
    id: 'decimal', title: 'Adding with carries', set: 'decimal',
    intro: "Let's add " + words(EXAMPLES.decimal.a) + ' and ' + words(EXAMPLES.decimal.b) +
      '. We line them up: ones under ones, and tens under tens.'
  });

  // ---------- 5.2 binary ----------

  // A hand (one hand: five fingers, so up to thirty-one) with its number under it.
  function handBox(n, label, cls) {
    var hand = NS.hands.create({ hands: 'right', bits: n });
    var num = U.el('span', { class: 'ad-hand-num', text: String(n) });
    var bin = U.el('span', { class: 'ad-hand-bin', text: NS.numeral.format(n, D.get('binary')) });
    var el = U.el('figure', { class: ['ad-hand', cls], 'aria-label': label + ': ' + words(n) },
      hand.el, U.el('figcaption', { class: 'ad-hand-cap' }, bin, num));
    return {
      el: el, hand: hand,
      show: function (v, ctx) {
        num.textContent = String(v);
        bin.textContent = NS.numeral.format(v, D.get('binary'));
        el.setAttribute('aria-label', label + ': ' + words(v));
        return hand.setBits(v, ctx);
      }
    };
  }

  var binEx = EXAMPLES.binary;
  var binary = exampleScene({
    id: 'binary', title: 'Adding in binary', set: 'binary',
    top: function (state) {
      state.rules = BINARY_RULES.map(function (terms) {
        var total = sum(terms);
        return hidden(U.el('div', { class: 'ad-rule', dataset: { total: String(total) } },
          U.el('span', { class: 'ad-rule-math', text: ruleText(terms) }),
          total > 1 ? U.el('span', { class: 'ad-rule-worth', text: '(' + total + ')' }) : null));
      });
      state.ruleRow = U.el('div', { class: 'ad-rules', role: 'list', 'aria-label': 'The four binary adding rules' }, state.rules);
      state.rules.forEach(function (r) { r.setAttribute('role', 'listitem'); });
      return state.ruleRow;
    },
    // The hands stand beside the rows they show: first number, second number, answer.
    side: function (state) {
      state.handA = handBox(binEx.a, 'First number');
      state.handB = handBox(binEx.b, 'Second number');
      state.handSum = handBox(0, 'Answer', 'is-answer');
      [state.handA, state.handB, state.handSum].forEach(function (h) { hidden(h.el); });
      return U.el('div', { class: 'ad-hands' }, state.handA.el, state.handB.el, state.handSum.el);
    },
    before: [{
      say: 'Binary adding has only four rules. ' + BINARY_RULES.map(ruleSay).join(' '),
      do: function (ctx) {
        var s = ctx.state;
        var chain = Promise.resolve();
        s.rules.forEach(function (r, k) {
          chain = chain.then(function () { return ctx.cue(k + 1); }).then(function () {
            sound(ctx, k >= 2 ? 'carry' : 'pop');
            return A.pop(r, ctx);
          });
        });
        return chain;
      }
    }],
    intro: "Let's add " + words(binEx.a) + ' and ' + words(binEx.b) + ". In binary, that's " +
      read(binEx.a, 'binary') + ' plus ' + read(binEx.b, 'binary') + '. Here they are on our hands!',
    introDo: function (ctx) {
      var s = ctx.state;
      s.ruleRow.classList.add('is-small');
      return ctx.cue(2).then(function () {
        sound(ctx, 'pop');
        return A.stagger([s.handA.el, s.handB.el], function (el) { return A.pop(el, ctx); }, 250, ctx);
      });
    },
    resultDo: function (ctx) {
      var s = ctx.state;
      return A.pop(s.handSum.el, ctx).then(function () { return s.handSum.show(binEx.a + binEx.b, ctx); });
    }
  });

  // ---------- 5.3 hex, 5.4 octal ----------

  var hex = exampleScene({
    id: 'hex', title: 'Adding in hex', set: 'hex',
    intro: "Now hex! Let's add " + read(EXAMPLES.hex.a, 'hex') + ' and ' + read(EXAMPLES.hex.b, 'hex') + '.'
  });

  var octal = exampleScene({
    id: 'octal', title: 'Adding octal', set: 'octal',
    intro: "Octal works the same way. Let's add " + read(EXAMPLES.octal.a, 'octal') + ' and ' + read(EXAMPLES.octal.b, 'octal') + '.'
  });

  // ---------- 5.5 animals, 5.6 colors ----------

  var animals = exampleScene({
    id: 'animals', title: 'Adding animals!', set: 'animals',
    intro: "Now let's add animals! " + read(EXAMPLES.animals.a, 'animals') + ' plus ' + read(EXAMPLES.animals.b, 'animals') + '.'
  });

  var colors = exampleScene({
    id: 'colors', title: 'Adding colors!', set: 'colors',
    intro: 'Colors count in base three. Let\'s add ' + read(EXAMPLES.colors.a, 'colors') + ' plus ' + read(EXAMPLES.colors.b, 'colors') + '.'
  });

  // ---------- 5.7 You try it! ----------

  var tryIt = {
    id: 'try',
    title: 'You try it!',
    interactive: true,
    setup: function (stage, setupCtx) {
      var ctrl = new AbortController();
      var signal = ctrl.signal;
      var live = { speed: 1, reducedMotion: setupCtx.reducedMotion, signal: signal, sound: function (n) { NS.sound.play(n); } };
      var s = { ctrl: ctrl, stars: 0, sys: 'decimal', columns: 2, carries: true, busy: false };

      function say(text) {
        if (signal.aborted) return;
        if (setupCtx.player && setupCtx.player.getMode() === 'playing') return;
        NS.narrator.speak('addition.try.live', text, { signal: signal }).catch(noop);
      }

      // --- Pickers: system, columns, carries ---
      function pressed(buttons, value) {
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.value === String(value))); });
      }
      var sysButtons = SYSTEMS.map(function (x) {
        var sample = NS.symbols.strip(x.set === 'binary' ? 5 : x.set === 'hex' ? 0x2A : 7, x.set, { class: 'ad-sys-sample' });
        sample.setAttribute('aria-hidden', 'true');
        return U.el('button', { type: 'button', class: ['btn', 'ad-sys', 'theme-' + D.resolve(x.set).theme], dataset: { value: x.set },
          'aria-pressed': 'false', onClick: function () { choose('sys', x.set); } }, sample, U.el('span', { text: x.name }));
      });
      var colButtons = [1, 2, 3].map(function (n) {
        return U.el('button', { type: 'button', class: 'btn ad-opt', dataset: { value: String(n) }, 'aria-pressed': 'false',
          'aria-label': n + (n === 1 ? ' column' : ' columns'), onClick: function () { choose('columns', n); } }, String(n));
      });
      var carryButtons = [true, false].map(function (v) {
        return U.el('button', { type: 'button', class: 'btn ad-opt', dataset: { value: String(v) }, 'aria-pressed': 'false',
          onClick: function () { choose('carries', v); } }, v ? 'With carries' : 'No carries');
      });
      function choose(kind, v) {
        if (s[kind] === v) return;
        s[kind] = v;
        NS.sound.play('click');
        newProblem(true);
      }
      var sysRow = U.el('div', { class: 'ad-systems', role: 'group', 'aria-label': 'Number system' }, sysButtons);
      var optRow = U.el('div', { class: 'ad-options' },
        U.el('div', { class: 'ad-opt-group', role: 'group', 'aria-label': 'How many columns' },
          U.el('span', { class: 'ad-opt-label', text: 'Columns:' }), colButtons),
        U.el('div', { class: 'ad-opt-group', role: 'group', 'aria-label': 'Carries' }, carryButtons),
        U.el('button', { type: 'button', class: 'btn ad-new', onClick: function () { newProblem(true); } },
          NS.icons.render('replay', { kind: 'ui' }), U.el('span', { text: 'New problem' })));

      // --- The problem card ---
      var starCount = U.el('span', { class: 'ad-star-count', text: '0' });
      var holder = U.el('div', { class: 'ad-holder' });
      var question = U.el('p', { class: 'ad-question', 'aria-live': 'polite' });
      var picker = U.el('div', { class: 'ad-picker', role: 'group', 'aria-label': 'Pick the digit to write' });
      var carryRow = U.el('div', { class: 'ad-carry-pick', role: 'group', 'aria-label': 'Carry or not', hidden: true });
      var feedback = U.el('p', { class: 'ad-feedback', 'aria-live': 'polite' });
      var check = U.el('div', { class: 'ad-try-check', hidden: true });
      var nextBtn = U.el('button', { type: 'button', class: 'btn btn-primary ad-next', hidden: true,
        onClick: function () { newProblem(true); } }, 'Next problem');
      var burstLayer = U.el('div', { class: 'ad-burst-anchor', 'aria-hidden': 'true' });
      var card = U.el('div', { class: 'ad-card' },
        U.el('span', { class: 'ad-stars', title: 'Stars' }, NS.icons.render('star', { kind: 'ui', class: 'ad-star-icon' }), starCount),
        holder, question, picker, carryRow, feedback, check, nextBtn, burstLayer);

      function symButton(v, set, cls, label, onPick) {
        var sym = NS.symbols.renderValue(v, set);
        sym.setAttribute('aria-hidden', 'true');
        sym.removeAttribute('role');
        var named = D.resolve(set).kind !== 'text';
        return U.el('button', { type: 'button', class: ['btn', cls], dataset: { value: String(v) }, 'aria-label': label,
          onClick: function (e) { onPick(v, e.currentTarget); } },
        sym, named ? U.el('span', { class: 'ad-pick-name', text: D.resolve(set).digits[v].label }) : null);
      }

      function current() { return s.problem.steps[s.col]; }

      function newProblem(speak) {
        s.busy = false;
        s.problem = makeProblem(s.sys, { columns: s.columns, carries: s.carries });
        s.col = 0;
        s.tries = 0;
        pressed(sysButtons, s.sys);
        pressed(colButtons, s.columns);
        pressed(carryButtons, s.carries);
        if (s.ca) s.ca.destroy();
        s.ca = makeAdder(s.sys, s.problem.a, s.problem.b, 'ad-try-adder');
        holder.appendChild(s.ca.el);
        card.classList.remove('is-won');
        card.className = 'ad-card theme-' + D.resolve(s.sys).theme;
        check.hidden = true;
        nextBtn.hidden = true;
        feedback.textContent = '';
        U.clear(picker);
        var set = D.resolve(s.sys);
        U.range(set.base).forEach(function (v) {
          picker.appendChild(symButton(v, set, 'ad-pick', set.digits[v].speak, pickDigit));
        });
        picker.classList.toggle('is-wide', set.base > 10);
        U.clear(carryRow);
        carryRow.appendChild(symButton(1, set, 'ad-carry-btn is-yes', 'Yes, carry ' + set.digits[1].speak, pickCarry));
        carryRow.firstChild.appendChild(U.el('span', { class: 'ad-carry-word', text: 'Carry!' }));
        carryRow.appendChild(U.el('button', { type: 'button', class: 'btn ad-carry-btn is-no', dataset: { value: '0' },
          onClick: function (e) { pickCarry(0, e.currentTarget); } }, U.el('span', { class: 'ad-carry-word', text: 'No carry' })));
        askDigit(speak);
      }

      function askDigit(speak) {
        var step = current();
        var q = columnQuestion(step, s.sys);
        s.phase = 'digit';
        s.tries = 0;
        s.ca.focusColumn(step.power);
        question.textContent = D.placeName(step.power, D.resolve(s.sys).base) + ': ' + q.text;
        picker.hidden = false;
        carryRow.hidden = true;
        Array.prototype.forEach.call(picker.children, function (b) { b.disabled = false; b.classList.remove('is-wrong'); });
        if (speak) say(q.say);
      }

      function wrong(btn, text) {
        btn.disabled = true;
        btn.classList.add('is-wrong');
        NS.sound.play('click');
        A.wiggle(btn, live).catch(noop);
        feedback.textContent = text;
        say(text);
      }

      function pickDigit(v, btn) {
        if (s.busy || s.phase !== 'digit') return;
        var step = current();
        if (!checkColumn(step, { digit: v }).digit) {
          s.tries += 1;
          wrong(btn, hint(step, s.sys, 'digit', s.tries));
          return;
        }
        s.busy = true;
        feedback.textContent = '';
        picker.hidden = true;
        s.ca.showSum(step, live).then(function () { return s.ca.writeDigit(step, live); }).then(function () {
          s.busy = false;
          if (!s.carries) return s.ca.carry(step, live).then(nextColumn);
          s.phase = 'carry';
          question.textContent = carryQuestion(s.sys);
          carryRow.hidden = false;
          Array.prototype.forEach.call(carryRow.children, function (b) { b.disabled = false; b.classList.remove('is-wrong'); });
          say(carryQuestion(s.sys));
        }).catch(noop);
      }

      function pickCarry(c, btn) {
        if (s.busy || s.phase !== 'carry') return;
        var step = current();
        if (!checkColumn(step, { digit: step.digit, carry: c }).carry) {
          wrong(btn, hint(step, s.sys, 'carry'));
          return;
        }
        s.busy = true;
        feedback.textContent = '';
        carryRow.hidden = true;
        s.ca.carry(step, live).then(nextColumn).catch(noop);
      }

      function nextColumn() {
        s.col += 1;
        var step = current();
        if (!step) return solved();
        if (step.finalCarry) {
          // The carried digit drops into its new place by itself.
          var text = ADD.explainStep(step, s.sys);
          feedback.textContent = text;
          say(text);
          return s.ca.showSum(step, live).then(function () { return s.ca.writeDigit(step, live); }).then(function () {
            s.col += 1;
            return solved();
          });
        }
        s.busy = false;
        askDigit(true);
      }

      function solved() {
        var p = s.problem;
        s.busy = true;
        s.phase = 'done';
        s.stars += 1;
        starCount.textContent = String(s.stars);
        s.ca.hideSum();
        s.ca.focusColumn(null);
        s.ca.el.classList.add('is-solved');
        card.classList.add('is-won');
        question.textContent = 'You did it!';
        picker.hidden = true;
        carryRow.hidden = true;
        U.clear(check);
        check.appendChild(checkBox(p.a, p.b, p.set));
        check.hidden = false;
        nextBtn.hidden = false;
        NS.sound.play('tada');
        var answer = cap(read(p.a + p.b, p.set)) + system(p.set).inName + '. ';
        feedback.textContent = p.set === 'decimal' ? '' : answer;
        say(PRAISE[(s.stars - 1) % PRAISE.length] + ' ' + (p.set === 'decimal' ? '' : answer) +
          cap(words(p.a)) + ' plus ' + words(p.b) + ' is ' + words(p.a + p.b) + '.');
        burst(burstLayer, live, 10).catch(noop);
        nextBtn.focus({ preventScroll: true });
      }

      newProblem(false);

      var root = U.el('div', { class: 'ad-scene ad-try' }, sysRow, optRow, card);
      stage.appendChild(root);
      s.sysRow = sysRow;
      s.optRow = optRow;
      s.card = card;
      s.picker = picker;
      s.carryRow = carryRow;
      s.newProblem = newProblem;
      s.choose = choose;
      return s;
    },
    teardown: function (stage, ctx) {
      var s = ctx.state;
      if (s.ctrl) s.ctrl.abort();
    },
    steps: [
      {
        say: 'Your turn! Pick a number system. Pick how many columns, and if you want carries. ' +
          'Then add one column at a time: pick the digit to write, and say if it carries.',
        do: function (ctx) {
          var s = ctx.state;
          return ctx.cue(1).then(function () {
            sound(ctx, 'pop');
            return A.highlight(s.sysRow, ctx);
          }).then(function () { return ctx.cue(2); }).then(function () {
            sound(ctx, 'pop');
            return A.highlight(s.optRow, ctx);
          }).then(function () { return ctx.cue(3); }).then(function () {
            sound(ctx, 'pop');
            return A.highlight(s.picker, ctx);
          });
        }
      }
    ]
  };

  NS.lessons.register({
    id: 'addition',
    order: 50,
    title: 'Adding in Every System',
    shortTitle: 'Adding',
    spokenTitle: 'Adding in every system', // Movie mode chapter card (js/movie.js)
    blurb: 'Carrying in tens, in binary, in hex, and with jumping animals.',
    ageHint: '7+',
    theme: 'addition',
    icon: 'plus',
    glyph: '+',
    scenes: [decimal, binary, hex, octal, animals, colors, tryIt],
    // Pure helpers, exposed for unit tests.
    helpers: {
      SYSTEMS: SYSTEMS, EXAMPLES: EXAMPLES, BINARY_RULES: BINARY_RULES, MAX_COLUMNS: MAX_COLUMNS,
      read: read, columnLead: columnLead, columnSay: columnSay, checkLine: checkLine, resultSay: resultSay,
      ruleText: ruleText, ruleSay: ruleSay, hasCarry: hasCarry, makeProblem: makeProblem, checkColumn: checkColumn,
      checkAnswer: checkAnswer, hint: hint, columnQuestion: columnQuestion, carryQuestion: carryQuestion
    }
  });
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
