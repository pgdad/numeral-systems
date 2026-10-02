describe('playground', function () {
  var H = NumSys.playground.helpers;
  var D = NumSys.digitsets;
  var N = NumSys.numeral;
  var RBR = { name: 'Robot-Banana-Rocket', base: 3, digits: [{ icon: 'robot' }, { icon: 'banana' }, { icon: 'rocket' }] };
  function seeded(seed) {
    var x = seed;
    return function () { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  }
  // A storage stand-in, like NumSys.util.storage (get/set, never throws). broken: set always fails.
  function memoryStore(broken) {
    var data = {};
    return {
      get: function (k, fallback) { return k in data ? JSON.parse(data[k]) : fallback; },
      set: function (k, v) { if (broken) return false; data[k] = JSON.stringify(v); return true; },
      data: data
    };
  }
  // Register a set for the test, then put things back.
  function withSet(set, fn) {
    D.register(set);
    try { fn(); } finally { D.unregister(set.id); }
  }

  it('registers the intro lesson and the view', function () {
    var lesson = NumSys.lessons.get('playground');
    expect(NumSys.lessons.validate(lesson)).toBe(lesson);
    expect(lesson.order).toBe(60);
    expect(lesson.scenes.map(function (s) { return !!s.interactive; })).toEqual([false, true]);
    lesson.scenes.forEach(function (s) { s.steps.forEach(function (st) { expect(/\d/.test(st.say)).toBe(false); }); });
    expect(typeof NumSys.playground.mount).toBe('function');
    expect(NumSys.router.parse('#/playground/quiz').params.tab).toBe('quiz');
    expect(NumSys.router.href('playground', { tab: 'make' })).toBe('#/playground/make');
  });

  it('builds Robot-Banana-Rocket, a base-3 system of pictures', function () {
    var b = H.buildSystem(RBR);
    expect(b.ok).toBe(true);
    expect(b.set.id).toBe('my-robot-banana-rocket');
    expect(b.set.kind).toBe('icon');
    expect(b.set.digits.map(function (d) { return d.label; })).toEqual(['Robot', 'Banana', 'Rocket']);
    withSet(b.set, function () {
      expect(H.textOf(13, b.set.id)).toBe('Banana-Banana-Banana');
      expect(D.speak(5, b.set.id)).toBe('Banana-Rocket');
      expect(H.readInput('banana rocket', b.set.id)).toEqual({ ok: true, value: 5 });
      expect(H.readInput('Banana-Duck', b.set.id).ok).toBe(false);
      expect(H.readInput('Banana-Duck', b.set.id).error).toContain('Robot, Banana and Rocket');
    });
  });

  it('mixes pictures, colored shapes and typed characters', function () {
    var b = H.buildSystem({ name: 'Mix', base: 4, digits: [{ icon: 'cat' }, { color: 'red', shape: 'circle' }, { color: 'red', shape: 'square' }, { char: 'Q' }] });
    expect(b.ok).toBe(true);
    expect(b.set.kind).toBe('mixed');
    // A color used twice is named with its shape (D18: never color alone).
    expect(b.set.digits.map(function (d) { return d.label; })).toEqual(['Cat', 'Red circle', 'Red square', 'Q']);
    expect(b.set.digits[0].sound).toBe('meow');
    expect(D.digitKind(b.set.digits[1], b.set)).toBe('color');
    expect(D.digitKind(b.set.digits[3], b.set)).toBe('text');
    withSet(b.set, function () {
      // Multi-word names are read as one digit.
      expect(H.readInput('Red square-Q red circle', b.set.id)).toEqual({ ok: true, value: 2 * 16 + 3 * 4 + 1 });
      expect(H.textOf(45, b.set.id)).toBe('Red square-Q-Red circle');
      expect(N.parse('q q', b.set).value).toBe(15);
    });
    var colors = H.buildSystem({ name: 'Lights', base: 2, digits: [{ color: 'blue', shape: 'star' }, { color: 'pink', shape: 'star' }] });
    expect(colors.set.kind).toBe('color');
    expect(colors.set.digits[1].label).toBe('Pink');
    var text = H.buildSystem({ name: 'Letters', base: 2, digits: [{ char: 'o' }, { char: 'x' }] });
    expect(text.set.kind).toBe('text');
  });

  it('explains what is wrong with a system', function () {
    expect(H.checkSpec(RBR)).toEqual([]);
    var errs = H.checkSpec({ name: '', base: 3, digits: [{ icon: 'cat' }, { icon: 'cat' }] });
    expect(errs).toEqual(['Give your system a name!',
      'The digits worth 0 and 1 look the same (Cat). Every digit needs its own look!',
      'Pick a symbol for the digit worth 2.']);
    expect(H.checkSpec({ name: 'x', base: 17, digits: [] })).toEqual(['Pick a base from 2 to 16.']);
    expect(H.checkSpec({ name: 'x', base: 1, digits: [] })).toEqual(['Pick a base from 2 to 16.']);
    expect(H.checkSpec({ name: 'x', base: 2, digits: [{ char: 'a' }, { char: 'A' }] })[0]).toContain('look the same');
    expect(H.checkSpec({ name: 'x', base: 2, digits: [{ char: '-' }, { char: 'ab' }] }).length).toBe(2);
    expect(H.checkSpec({ name: 'x', base: 2, digits: [{ icon: 'dragon' }, { color: 'gold', shape: 'circle' }] }).length).toBe(2);
    expect(H.checkSpec({ name: new Array(30).join('a'), base: 2, digits: [{ char: 'a' }, { char: 'b' }] })[0]).toContain('a bit long');
    // Two of the same color and shape look the same; different shapes are fine.
    expect(H.checkSpec({ name: 'x', base: 2, digits: [{ color: 'red', shape: 'star' }, { color: 'red', shape: 'star' }] }).length).toBe(1);
    expect(H.checkSpec({ name: 'x', base: 2, digits: [{ color: 'red', shape: 'star' }, { color: 'red', shape: 'circle' }] })).toEqual([]);
    // Extra digits from a bigger base are ignored after shrinking the base.
    expect(H.buildSystem({ name: 'x', base: 2, digits: [{ char: 'a' }, { char: 'b' }, { char: 'c' }] }).set.digits.length).toBe(2);
  });

  it('exports and imports systems as text', function () {
    var text = H.exportText(RBR);
    expect(JSON.parse(text).base).toBe(3);
    var back = H.importText(text);
    expect(back.ok).toBe(true);
    expect(back.spec).toEqual(RBR);
    expect(H.importText('  ' + text + '\n').ok).toBe(true);
    expect(H.importText('[' + text + ']').ok).toBe(true);
    expect(H.importText('{oops').error).toContain("doesn't look like");
    expect(H.importText('').ok).toBe(false);
    expect(H.importText('{"name": "x", "base": 2, "digits": [{"icon": "cat"}]}').error).toBe('Pick a symbol for the digit worth 1.');
  });

  it('saves and loads systems, and copes with blocked storage', function () {
    var store = memoryStore();
    expect(H.loadSpecs(store)).toEqual([]);
    var list = H.upsert([], RBR);
    expect(H.saveSpecs(list, store)).toBe(true);
    expect(H.loadSpecs(store)).toEqual([RBR]);
    // Same name = same system: saving again replaces it.
    var changed = { name: 'robot banana rocket', base: 2, digits: [{ icon: 'robot' }, { icon: 'banana' }] };
    expect(H.upsert(list, changed)).toEqual([changed]);
    // Junk in storage is skipped, not fatal.
    store.data[H.STORE_KEY] = JSON.stringify([{ name: 'bad' }, RBR, 7]);
    expect(H.loadSpecs(store)).toEqual([RBR]);
    store.data[H.STORE_KEY] = '"nope"';
    expect(H.loadSpecs(store)).toEqual([]);
    var broken = memoryStore(true);
    expect(H.saveSpecs(list, broken)).toBe(false);
    expect(H.loadSpecs(broken)).toEqual([]);
    expect(H.recordScore('easy', 5, broken)).toBe(true);
    expect(H.loadBest('easy', broken)).toBe(0);
    var good = memoryStore();
    expect(H.recordScore('hard', 4, good)).toBe(true);
    expect(H.recordScore('hard', 3, good)).toBe(false);
    expect(H.loadBest('hard', good)).toBe(4);
  });

  it('keeps every converter representation in sync', function () {
    // Typing in any system gives the same number, and every other box shows it.
    var all = H.convertAll(255);
    expect(all.map(function (r) { return r.text; })).toEqual(['255', '11111111', '377', 'FF', 'Frog-Cat-Dog-Cat', 'Yellow-Red-Red-Yellow-Yellow-Red']);
    all.forEach(function (r) { expect(H.readInput(r.text, r.id)).toEqual({ ok: true, value: 255 }); });
    for (var n = 0; n <= 300; n += 7) {
      H.convertAll(n).forEach(function (r) { expect(H.readInput(r.text, r.id).value).toBe(n); });
    }
    expect(H.readInput('1,000', 'decimal').value).toBe(1000);
    expect(H.readInput('1111 1111', 'binary').value).toBe(255);
    expect(H.readInput('0xff', 'hex').value).toBe(255);
    expect(H.readInput('#FF', 'hex').value).toBe(255);
    expect(H.readInput('dog frog', 'animals').value).toBe(7);
    // Friendly help instead of nonsense.
    expect(H.readInput('', 'decimal').error).toBe('Type a number first!');
    expect(H.readInput('12', 'binary').error).toBe("2 isn't a digit in binary: binary only uses 0–1!");
    expect(H.readInput('-5', 'decimal').error).toContain('No minus numbers');
    expect(H.readInput('2.5', 'decimal').error).toContain('whole numbers');
    expect(H.readInput(new Array(50).join('9'), 'decimal').error).toContain('too big');
    // Big numbers become BigInts (still in sync), and are too big to draw or show on fingers.
    var big = H.readInput('123456789012345678901234567890', 'decimal').value;
    expect(typeof big).toBe('bigint');
    expect(H.readInput(H.textOf(big, 'hex'), 'hex').value === big).toBe(true);
    expect(H.canDraw(big, 'animals')).toBe(false);
    expect(H.canDraw(13, 'animals')).toBe(true);
    expect(H.onFingers(1023)).toBe(true);
    expect(H.onFingers(1024)).toBe(false);
    // +1 / -1 never go below zero and work for BigInts.
    expect(H.stepValue(0, -1)).toBe(0);
    expect(H.stepValue(9, 1)).toBe(10);
    expect(H.stepValue(Number.MAX_SAFE_INTEGER, 1) === BigInt(Number.MAX_SAFE_INTEGER) + 1n).toBe(true);
    expect(H.stepValue(BigInt(Number.MAX_SAFE_INTEGER) + 1n, -1)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('makes quizzes with valid answers and no duplicate choices', function () {
    var b = H.buildSystem(RBR);
    withSet(b.set, function () {
      H.LEVEL_IDS.forEach(function (lv) {
        var L = H.LEVELS[lv];
        for (var seed = 1; seed <= 60; seed++) {
          var quiz = H.makeQuiz(lv, { rand: seeded(seed), customSets: [b.set.id] });
          expect(quiz.length).toBe(H.QUIZ_LENGTH);
          var types = {};
          quiz.forEach(function (q) {
            var where = lv + ' #' + seed + ' ' + q.type + ' ' + q.set + ': ' + q.text;
            types[q.type] = true;
            if (!q.text || !q.say || /\d/.test(q.say)) throw new Error('bad text: ' + where);
            if (q.type === 'fingers') {
              if (q.answer < 1 || q.answer > L.fingersMax || H.NOT_ALONE.indexOf(q.answer) >= 0) throw new Error('bad finger target: ' + where);
              return;
            }
            if (q.set === 'decimal') throw new Error('decimal question: ' + where);
            if (q.choices.length !== L.choices) throw new Error('choice count: ' + where);
            if (q.choices.filter(function (c) { return c === q.answer; }).length !== 1) throw new Error('answer not offered once: ' + where);
            q.choices.forEach(function (c, i) {
              if (c < 0 || c !== Math.floor(c)) throw new Error('bad choice ' + c + ': ' + where);
              if (q.choices.indexOf(c) !== i) throw new Error('duplicate choice: ' + where);
            });
            // Choices drawn in a system also look different.
            var shown = q.choices.map(function (c) { return H.textOf(c, q.choiceSet); });
            shown.forEach(function (t, i) { if (shown.indexOf(t) !== i) throw new Error('two choices look alike: ' + where); });
            if (q.type === 'to-ten') { expect(q.choiceSet).toBe('decimal'); expect(q.show.value).toBe(q.answer); }
            if (q.type === 'from-ten') expect(q.choiceSet).toBe(q.set);
            if (q.type === 'next') expect(q.answer).toBe(q.show.values[2] + 1);
            if (q.type === 'add') expect(q.answer).toBe(q.show.a + q.show.b);
            if (q.type !== 'add' && q.answer > H.maxFor(q.set, L) + 1) throw new Error('too big for the level: ' + where);
            expect(H.isRight(q, q.answer)).toBe(true);
            expect(H.explain(q).say.length > 0).toBe(true);
          });
          expect(Object.keys(types).sort()).toEqual(['add', 'fingers', 'from-ten', 'next', 'to-ten']);
        }
      });
    });
  });

  it('pitches questions at the right level and explains answers', function () {
    // Easy add questions never need a carry; easy numbers are small.
    for (var seed = 1; seed <= 40; seed++) {
      var q = H.makeQuestion('add', 'animals', 'easy', seeded(seed));
      expect(q.show.a + q.show.b < 5).toBe(true);
      expect(H.makeQuestion('to-ten', 'binary', 'easy', seeded(seed)).answer <= 15).toBe(true);
      expect(H.makeQuestion('fingers', null, 'easy', seeded(seed)).answer <= 31).toBe(true);
    }
    expect(H.maxFor('colors', H.LEVELS.easy)).toBe(8);
    expect(H.maxFor('hex', H.LEVELS.hard)).toBe(1000);
    expect(H.misread(9, 'animals')).toBe(14);
    expect(H.misread(3, 'animals')).toBe(null);
    expect(H.noCarrySum(0xA6, 0x7A, 16)).toBe(0x10);
    expect(H.explain({ type: 'to-ten', set: 'animals', answer: 13 })).toEqual({ text: 'Frog-Pig is 13.', say: 'Frog-Pig is thirteen.' });
    expect(H.explain({ type: 'from-ten', set: 'binary', answer: 13 }).text).toBe('13 in binary is 1101.');
    expect(H.explain({ type: 'next', set: 'animals', answer: 5, show: { values: [2, 3, 4] } }).say).toBe('After Duck comes Dog-Cat.');
    expect(H.explain({ type: 'add', set: 'animals', answer: 9, show: { a: 4, b: 5 } }).text).toBe('Duck + Dog-Cat = Dog-Duck  (4 + 5 = 9).');
    expect(H.explain({ type: 'add', set: 'binary', answer: 1, show: { a: 0, b: 1 } }).text).toBe('0 + 1 = 1.');
    expect(H.explain({ type: 'fingers', set: 'binary', answer: 19 })).toEqual({ text: '19 = 16 + 2 + 1.', say: 'Nineteen is sixteen plus two plus one.' });
  });
});
