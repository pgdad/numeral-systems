describe('lesson: addition', function () {
  var lesson = NumSys.lessons.get('addition');
  var H = lesson.helpers;
  var ADD = NumSys.addition;
  var D = NumSys.digitsets;
  var split = NumSys.narrator.splitSentences;

  function steps() {
    var out = [];
    lesson.scenes.forEach(function (s) { out = out.concat(s.steps); });
    return out;
  }
  function scene(id) { return lesson.scenes.filter(function (s) { return s.id === id; })[0]; }
  function base(set) { return D.resolve(set).base; }
  // A small seeded random number generator, so the generator tests are repeatable.
  function seeded(seed) {
    var x = seed;
    return function () { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  }

  it('is registered and valid', function () {
    expect(NumSys.lessons.validate(lesson)).toBe(lesson);
    expect(lesson.order).toBe(50);
    expect(lesson.theme).toBe('addition');
    expect(lesson.scenes.map(function (s) { return s.id; })).toEqual(['decimal', 'binary', 'hex', 'octal', 'animals', 'colors', 'try']);
    expect(lesson.scenes.map(function (s) { return !!s.interactive; })).toEqual([false, false, false, false, false, false, true]);
    expect(H.SYSTEMS.map(function (x) { return x.set; })).toEqual(['decimal', 'binary', 'octal', 'hex', 'animals', 'colors']);
    // Every system has its own carry flavor.
    var hops = H.SYSTEMS.map(function (x) { return x.hop; });
    hops.forEach(function (h, i) { expect(hops.indexOf(h)).toBe(i); });
  });

  it('has narration on every step, numbers in words', function () {
    expect(steps().length > 20).toBe(true);
    steps().forEach(function (st) {
      expect(st.say.trim().length > 0).toBe(true);
      expect(/\d/.test(st.say)).toBe(false);
    });
  });

  it('narration lasts a few minutes', function () {
    var ms = 0;
    steps().forEach(function (st) {
      split(st.say).forEach(function (sentence) { ms += NumSys.narrator.estimateMs(sentence, 1); });
    });
    expect(ms > 90000 && ms < 300000).toBe(true);
  });

  it('generates every column step from addSteps and explainStep', function () {
    ['decimal', 'binary', 'hex', 'octal', 'animals', 'colors'].forEach(function (id) {
      var ex = H.EXAMPLES[id];
      var cols = ADD.addSteps(ex.a, ex.b, base(id));
      var sc = scene(id);
      var said = sc.steps.map(function (st) { return st.say; });
      cols.forEach(function (step) {
        var line = H.columnLead(step, id) + ' ' + ADD.explainStep(step, id);
        expect(said).toContain(line);
        // Three sentences: the lead (cue 0), the sum (cue 1), write and carry (cue 2).
        expect(split(line).length).toBe(3);
      });
      // Intro + one step per column + the answer (binary adds the rules first).
      expect(sc.steps.length).toBe(cols.length + 2 + (id === 'binary' ? 1 : 0));
      expect(sc.steps[sc.steps.length - 1].say).toBe(H.resultSay(id, ex.a, ex.b));
    });
  });

  it('matches the CONTENT.md examples', function () {
    var E = H.EXAMPLES;
    expect(scene('decimal').steps[1].say).toBe("Ones first! Seven plus eight is fifteen. That's one ten and five, so write five and carry one.");
    expect(scene('decimal').steps[3].say).toContain('eighty-five');
    expect(H.read(E.hex.a, 'hex')).toBe('two A');
    expect(H.read(E.octal.a, 'octal')).toBe('one-seven');
    expect(H.read(E.animals.a, 'animals') + ' + ' + H.read(E.animals.b, 'animals')).toBe('Dog-Frog + Frog-Pig');
    expect(H.read(E.colors.a, 'colors') + ' + ' + H.read(E.colors.b, 'colors')).toBe('yellow-green + green-green');
    expect(scene('animals').steps[1].say).toContain('write Cat and carry Dog');
    expect(H.resultSay('animals', E.animals.a, E.animals.b)).toBe("The answer is Duck-Cat! Let's check in base ten. Seven plus thirteen is twenty. Yes!");
    expect(H.resultSay('hex', E.hex.a, E.hex.b)).toContain('four nine in hex');
    expect(H.resultSay('hex', E.hex.a, E.hex.b)).toContain('seventy-three');
    expect(H.checkLine(7, 13)).toBe('7 + 13 = 20 ✓');
    expect(H.columnLead({ power: 2 }, 'colors')).toBe('Now the nines.');
    expect(H.columnLead({ power: 1 }, 'animals')).toBe('Now the fives.');
  });

  it('states the four binary rules', function () {
    expect(H.BINARY_RULES.map(H.ruleText)).toEqual(['0 + 0 = 0', '0 + 1 = 1', '1 + 1 = 10', '1 + 1 + 1 = 11']);
    expect(H.ruleSay([1, 1])).toBe("One plus one is one-zero, that's two.");
    var rules = split(scene('binary').steps[0].say);
    expect(rules.length).toBe(5);
    expect(rules[4]).toBe("One plus one plus one is one-one, that's three.");
  });

  it('makes problems that respect columns and carries', function () {
    var rand = seeded(42);
    H.SYSTEMS.forEach(function (x) {
      var b = base(x.set);
      [1, 2, 3].forEach(function (cols) {
        [true, false].forEach(function (carries) {
          for (var k = 0; k < 40; k++) {
            var p = H.makeProblem(x.set, { columns: cols, carries: carries }, rand);
            var where = x.set + ' ' + cols + ' ' + carries + ': ' + p.a + '+' + p.b;
            if (p.b < 1) throw new Error('second number is zero: ' + where);
            if (p.a >= Math.pow(b, cols) || p.b >= Math.pow(b, cols)) throw new Error('too many digits: ' + where);
            if (cols > 1 && p.a < Math.pow(b, cols - 1)) throw new Error('too few digits: ' + where);
            if (H.hasCarry(p.a, p.b, b) !== carries) throw new Error('carry mismatch: ' + where);
            expect(p.steps).toEqual(ADD.addSteps(p.a, p.b, b));
            expect(p.columns).toBe(cols);
          }
        });
      });
    });
  });

  it('clamps difficulty and always finds a problem', function () {
    // Binary with one column and no carries has only one problem left: 0 + 1.
    var p = H.makeProblem('binary', { columns: 1, carries: false }, seeded(7));
    expect([p.a, p.b]).toEqual([0, 1]);
    // Binary with one column and carries: 1 + 1.
    p = H.makeProblem('binary', { columns: 1, carries: true }, seeded(7));
    expect([p.a, p.b]).toEqual([1, 1]);
    expect(H.makeProblem('decimal', { columns: 9 }, seeded(3)).columns).toBe(H.MAX_COLUMNS);
    expect(H.makeProblem('decimal', { columns: 0 }, seeded(3)).columns).toBe(2);
    // A random source that always says the same thing still terminates.
    p = H.makeProblem('hex', { columns: 2, carries: true }, function () { return 0; });
    expect(H.hasCarry(p.a, p.b, 16)).toBe(true);
  });

  it('checks columns and whole answers', function () {
    var steps = ADD.addSteps(0x2A, 0x1F, 16);
    expect(H.checkColumn(steps[0], { digit: 9 })).toEqual({ digit: true, carry: null });
    expect(H.checkColumn(steps[0], { digit: 9, carry: 1 })).toEqual({ digit: true, carry: true });
    expect(H.checkColumn(steps[0], { digit: 9, carry: 0 })).toEqual({ digit: true, carry: false });
    expect(H.checkColumn(steps[0], { digit: 0x19 })).toEqual({ digit: false, carry: null });
    expect(H.checkColumn(steps[1], { digit: 4, carry: 0 })).toEqual({ digit: true, carry: true });
    var p = { set: 'animals', a: 7, b: 13 };
    expect(H.checkAnswer(p, [4, 0])).toBe(true);    // Duck-Cat
    expect(H.checkAnswer(p, [2, 0])).toBe(false);
    expect(H.checkAnswer(p, [0, 4, 0])).toBe(false); // no leading Cat
    expect(H.checkAnswer(p, [5, 0])).toBe(false);    // not an animal digit
    expect(H.checkAnswer(p, [])).toBe(false);
    expect(H.checkAnswer({ set: 'binary', a: 5, b: 3 }, [1, 0, 0, 0])).toBe(true);
  });

  it('gives gentle hints from explainStep', function () {
    var step = ADD.addSteps(7, 13, 5)[0];
    expect(H.hint(step, 'animals', 'digit', 1)).toBe('Not quite. Frog plus Pig is two plus three, five.');
    expect(H.hint(step, 'animals', 'digit', 2)).toBe('Here is how: ' + ADD.explainStep(step, 'animals'));
    expect(H.hint(step, 'animals', 'carry')).toBe("We need to carry! That's one five and zero, so write Cat and carry Dog.");
    var calm = ADD.addSteps(1, 2, 10)[0];
    expect(H.hint(calm, 'decimal', 'carry')).toBe('No carry this time. Three is less than ten, so nothing carries.');
    var withCarry = ADD.addSteps(47, 38, 10)[1];
    expect(H.columnQuestion(withCarry, 'decimal')).toEqual({ text: '1 + 4 + 3\u00a0=\u00a0?', say: 'One plus four plus three. Which digit do we write?' });
    var green = D.get('colors').digits[2].label;
    expect(H.columnQuestion(ADD.addSteps(5, 8, 3)[0], 'colors').text).toBe(green + ' + ' + green + '\u00a0=\u00a0?');
    expect(H.carryQuestion('animals')).toBe('Do we carry Dog?');
    expect(H.carryQuestion('hex')).toBe('Do we carry a one?');
  });
});
