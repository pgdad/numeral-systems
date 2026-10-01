describe('addition: worked examples from CONTENT.md', function () {
  var A = NumSys.addition;
  var N = NumSys.numeral;
  var D = NumSys.digitsets;

  function pick(steps) {
    return steps.map(function (s) {
      return [s.da, s.db, s.carryIn, s.total, s.digit, s.carryOut];
    });
  }
  function explain(steps, set) { return steps.map(function (s) { return A.explainStep(s, set); }); }

  it('5.1 decimal: 47 + 38 = 85', function () {
    var r = A.add(47, 38, 10);
    expect(r.sum).toBe(85);
    expect(r.digits).toEqual([8, 5]);
    expect(pick(r.steps)).toEqual([[7, 8, 0, 15, 5, 1], [4, 3, 1, 8, 8, 0]]);
    expect(explain(r.steps, 'decimal')).toEqual([
      "Seven plus eight is fifteen. That's one ten and five, so write five and carry one.",
      'One plus four plus three is eight. Write eight.'
    ]);
  });

  it('5.2 binary: 101 + 011 = 1000', function () {
    var r = A.add(5, 3, 2);
    expect(N.format(r.sum, D.get('binary'))).toBe('1000');
    expect(r.digits).toEqual([1, 0, 0, 0]);
    expect(r.steps.length).toBe(4);
    expect(r.steps[3].finalCarry).toBe(true);
    expect(explain(r.steps, 'binary')).toEqual([
      "One plus one is two. That's one two and zero, so write zero and carry one.",
      "One plus zero plus one is two. That's one two and zero, so write zero and carry one.",
      "One plus one plus zero is two. That's one two and zero, so write zero and carry one.",
      'The carried one moves into a new place all by itself. Write one.'
    ]);
  });

  it('5.3 hex: 2A + 1F = 49 (seventy-three)', function () {
    var r = A.add(0x2A, 0x1F, 16);
    expect(r.sum).toBe(73);
    expect(N.format(r.sum, D.get('hex'))).toBe('49');
    expect(explain(r.steps, 'hex')).toEqual([
      "A plus F is ten plus fifteen, twenty-five. That's one sixteen and nine, so write nine and carry one.",
      'One plus two plus one is four. Write four.'
    ]);
  });

  it('5.4 octal: 17 + 5 = 24', function () {
    var r = A.add(N.parse('17', D.get('octal')).value, 5, 8);
    expect(N.format(r.sum, D.get('octal'))).toBe('24');
    expect(r.sum).toBe(20);
    expect(A.explainStep(r.steps[0], 'octal'))
      .toBe("Seven plus five is twelve. That's one eight and four, so write four and carry one.");
  });

  it('5.5 animals: Dog-Frog + Frog-Pig = Duck-Cat (7 + 13 = 20)', function () {
    var animals = D.get('animals');
    var a = N.parse('Dog-Frog', animals).value;
    var b = N.parse('Frog-Pig', animals).value;
    expect([a, b]).toEqual([7, 13]);
    var r = A.add(a, b, 5);
    expect(r.sum).toBe(20);
    expect(D.speak(r.sum, animals)).toBe('Duck-Cat');
    expect(explain(r.steps, animals)).toEqual([
      "Frog plus Pig is two plus three, five. That's one five and zero, so write Cat and carry Dog.",
      "Dog plus Dog plus Frog is one plus one plus two, four. That's Duck, so write Duck."
    ]);
  });

  it('5.6 colors: Yellow-Green + Green-Green = Yellow-Yellow-Yellow (5 + 8 = 13)', function () {
    var colors = D.get('colors');
    var a = N.parse('Yellow-Green', colors).value;
    var b = N.parse('Green-Green', colors).value;
    expect([a, b]).toEqual([5, 8]);
    var r = A.add(a, b, 3);
    expect(D.speak(r.sum, colors)).toBe('yellow-yellow-yellow');
    expect(r.steps.map(function (s) { return s.carryOut; })).toEqual([1, 1, 0]);
    expect(A.explainStep(r.steps[0], colors))
      .toBe("Green plus green is two plus two, four. That's one three and one, so write yellow and carry yellow.");
  });
});

describe('addition: general behaviour', function () {
  var A = NumSys.addition;

  it('matches a + b for many values and bases', function () {
    for (var base = 2; base <= 16; base++) {
      for (var a = 0; a <= 60; a += 7) {
        for (var b = 0; b <= 60; b += 5) {
          var r = A.add(a, b, base);
          var back = NumSys.numeral.fromDigits(r.digits, base);
          if (back !== a + b) throw new Error(a + '+' + b + ' in base ' + base + ' gave ' + back);
        }
      }
    }
  });

  it('handles numbers of different lengths and zero', function () {
    var r = A.add(999, 1, 10);
    expect(r.digits).toEqual([1, 0, 0, 0]);
    expect(r.steps.map(function (s) { return s.db; })).toEqual([1, 0, 0, 0]);
    expect(A.add(0, 0, 2).digits).toEqual([0]);
  });

  it('steps carry column, power and placeValue', function () {
    var steps = A.addSteps(250, 7, 10);
    expect(steps.map(function (s) { return s.column; })).toEqual([0, 1, 2]);
    expect(steps.map(function (s) { return s.placeValue; })).toEqual([1, 10, 100]);
  });

  it('no-carry hex column explains the letter', function () {
    var step = A.addSteps(0xA, 0x1, 16)[0];
    expect(A.explainStep(step, 'hex')).toBe("A plus one is ten plus one, eleven. That's B, so write B.");
  });

  it('rejects negative or fractional inputs', function () {
    expect(function () { A.addSteps(-1, 2, 10); }).toThrow('whole number');
    expect(function () { A.addSteps(1, 2.5, 10); }).toThrow('whole number');
  });
});
